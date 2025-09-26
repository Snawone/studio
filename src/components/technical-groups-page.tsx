'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { Users, Loader2, PlusCircle, Trash2, UserPlus, UserMinus, Search } from 'lucide-react';
import { type TechnicalGroup, type Technician, type UserProfile } from '@/lib/data';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuthContext } from '@/firebase/auth/auth-provider';


const createGroupSchema = z.object({
  name: z.string().min(3, "El nombre del grupo debe tener al menos 3 caracteres."),
});
type CreateGroupFormValues = z.infer<typeof createGroupSchema>;

const addTechnicianSchema = z.object({
  email: z.string().email("Por favor, ingresa un correo válido."),
});
type AddTechnicianFormValues = z.infer<typeof addTechnicianSchema>;


export function TechnicalGroupsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { profile } = useAuthContext();
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);
  const [isSubmittingTechnician, setIsSubmittingTechnician] = useState<string | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<TechnicalGroup | null>(null);

  const groupsCollectionRef = useMemoFirebase(() => collection(firestore, 'technical-groups'), [firestore]);
  const { data: technicalGroups, isLoading: isLoadingGroups } = useCollection<TechnicalGroup>(groupsCollectionRef);
  
  const createGroupForm = useForm<CreateGroupFormValues>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: { name: '' },
  });

  const addTechnicianForm = useForm<AddTechnicianFormValues>({
    resolver: zodResolver(addTechnicianSchema),
    defaultValues: { email: '' },
  });

  const handleCreateGroup = async (values: CreateGroupFormValues) => {
    setIsSubmittingGroup(true);
    const newGroupData = {
      name: values.name,
      createdAt: new Date().toISOString(),
      technicians: [],
    };
    
    try {
        await addDocumentNonBlocking(collection(firestore, 'technical-groups'), newGroupData);
        toast({ title: "Grupo creado", description: `El grupo "${values.name}" ha sido creado.` });
        createGroupForm.reset();
    } catch(e) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo crear el grupo.' });
    } finally {
        setIsSubmittingGroup(false);
    }
  };
  
  const handleAddTechnician = async (groupId: string, values: AddTechnicianFormValues) => {
    setIsSubmittingTechnician(groupId);
    const group = technicalGroups?.find(g => g.id === groupId);
    if (!group) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se encontró el grupo.' });
        setIsSubmittingTechnician(null);
        return;
    }

    try {
        const usersRef = collection(firestore, "users");
        const q = query(usersRef, where("email", "==", values.email));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            toast({ variant: 'destructive', title: 'Usuario no encontrado', description: `No se encontró ningún usuario con el email ${values.email}.`});
            setIsSubmittingTechnician(null);
            return;
        }

        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data() as UserProfile;

        const newTechnician: Technician = {
            userId: userDoc.id,
            userName: userData.name,
            addedAt: new Date().toISOString(),
        };

        if (group.technicians?.some(t => t.userId === newTechnician.userId)) {
            toast({ variant: 'destructive', title: 'Técnico duplicado', description: `${newTechnician.userName} ya está en este grupo.`});
            setIsSubmittingTechnician(null);
            return;
        }

        const updatedTechnicians = [...(group.technicians || []), newTechnician];
        await updateDocumentNonBlocking(doc(firestore, 'technical-groups', groupId), { technicians: updatedTechnicians });

        toast({ title: "Técnico añadido", description: `"${newTechnician.userName}" fue añadido a "${group.name}".`});
        addTechnicianForm.reset();
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Ocurrió un error al buscar o añadir el técnico.'});
    } finally {
        setIsSubmittingTechnician(null);
    }
  };

  const handleRemoveTechnician = async (groupId: string, techId: string) => {
    const group = technicalGroups?.find(g => g.id === groupId);
    if (!group) return;

    const techToRemove = group.technicians.find(t => t.userId === techId);
    const updatedTechnicians = group.technicians.filter(t => t.userId !== techId);
    await updateDocumentNonBlocking(doc(firestore, 'technical-groups', groupId), { technicians: updatedTechnicians });
    toast({ title: "Técnico eliminado", description: `"${techToRemove?.userName}" fue eliminado de "${group.name}".`});
  }

  const handleDeleteGroup = async (group: TechnicalGroup) => {
    await deleteDocumentNonBlocking(doc(firestore, 'technical-groups', group.id));
    toast({ title: "Grupo eliminado", description: `El grupo "${group.name}" ha sido eliminado.`});
  }

  if (isLoadingGroups) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Cargando datos...</p>
      </div>
    );
  }
  

  return (
    <section className="w-full max-w-4xl mx-auto flex flex-col gap-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-headline font-semibold flex items-center gap-2">
          <Users className="h-6 w-6" />
          Gestión de Grupos Técnicos
        </h2>
        <p className="text-muted-foreground text-sm">
          Crea grupos, añade técnicos por su correo electrónico y adminístralos.
        </p>
      </div>
      
       {profile?.isAdmin && (
         <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><PlusCircle className="h-5 w-5 text-primary"/>Crear Nuevo Grupo</CardTitle>
            </CardHeader>
            <Form {...createGroupForm}>
                <form onSubmit={createGroupForm.handleSubmit(handleCreateGroup)}>
                    <CardContent>
                        <FormField
                          control={createGroupForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nombre del Grupo</FormLabel>
                              <FormControl>
                                <Input placeholder="Ej: Equipo de Instalaciones A" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" disabled={isSubmittingGroup}>
                            {isSubmittingGroup && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isSubmittingGroup ? 'Creando...' : 'Crear Grupo'}
                        </Button>
                    </CardFooter>
                </form>
            </Form>
          </Card>
       )}
      
      <div>
        <h3 className="text-lg font-semibold mb-4">Grupos Existentes</h3>
        {technicalGroups && technicalGroups.length > 0 ? (
          <Accordion type="single" collapsible className="w-full" defaultValue={technicalGroups[0].id}>
            {technicalGroups.sort((a,b) => a.name.localeCompare(b.name)).map(group => (
              <AccordionItem value={group.id} key={group.id}>
                <AccordionTrigger>
                    <div className='flex items-center justify-between w-full pr-4'>
                        <div className='flex items-center gap-2'>
                           <Users className="h-5 w-5 text-muted-foreground"/>
                           <span>{group.name}</span>
                           <span className="text-xs text-muted-foreground">({group.technicians?.length || 0} técnicos)</span>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    <div className='space-y-6 p-2'>
                        <div>
                            <h4 className="font-medium mb-2">Técnicos en este grupo:</h4>
                            {group.technicians && group.technicians.length > 0 ? (
                                <ul className='space-y-2'>
                                    {group.technicians.sort((a,b) => a.userName.localeCompare(b.userName)).map(tech => (
                                        <li key={tech.userId} className="flex items-center justify-between text-sm bg-muted/50 p-2 rounded-md">
                                            <span>{tech.userName}</span>
                                            {profile?.isAdmin && (
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveTechnician(group.id, tech.userId)}>
                                                    <UserMinus className="h-4 w-4 text-destructive"/>
                                                </Button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            ): (
                                <p className="text-sm text-muted-foreground">Aún no hay técnicos en este grupo.</p>
                            )}
                        </div>
                        {profile?.isAdmin && (
                            <>
                                <Form {...addTechnicianForm}>
                                    <form onSubmit={addTechnicianForm.handleSubmit((values) => handleAddTechnician(group.id, values))} className="space-y-4">
                                        <FormField
                                        control={addTechnicianForm.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Añadir técnico por email</FormLabel>
                                            <div className="flex gap-2">
                                                <FormControl>
                                                    <Input placeholder="correo@ejemplo.com" {...field} />
                                                </FormControl>
                                                <Button type="submit" disabled={isSubmittingTechnician === group.id}>
                                                    {isSubmittingTechnician === group.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <UserPlus className="h-4 w-4"/>}
                                                </Button>
                                            </div>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                        />
                                    </form>
                                </Form>
                                <div className="border-t pt-4">
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="destructive" size="sm">
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Eliminar Grupo
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Esta acción es permanente y eliminará el grupo <strong>{group.name}</strong> y todos sus técnicos.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteGroup(group)}>Sí, eliminar</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </>
                        )}
                    </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <p className="text-center text-sm text-muted-foreground py-8 border rounded-md">
            No hay grupos técnicos creados.
          </p>
        )}
      </div>

    </section>
  );
}

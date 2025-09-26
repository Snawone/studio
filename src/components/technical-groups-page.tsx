'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, writeBatch, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Loader2, Warehouse, PlusCircle, Edit, Trash2, Users, UserPlus } from 'lucide-react';
import { type TechnicalGroup, type UserProfile, type Technician } from '@/lib/data';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useAuthContext } from '@/firebase/auth/auth-provider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const groupSchema = z.object({
  name: z.string().min(1, "El nombre del grupo es requerido."),
});

type GroupFormValues = z.infer<typeof groupSchema>;

const technicianSchema = z.object({
  userId: z.string().min(1, "Debe seleccionar un técnico."),
});

type TechnicianFormValues = z.infer<typeof technicianSchema>;


export function TechnicalGroupsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { profile } = useAuthContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeDialog, setActiveDialog] = useState<null | 'createGroup' | 'addTechnician' | 'editGroup' | 'deleteGroup' | 'removeTechnician'>(null);
  const [selectedGroup, setSelectedGroup] = useState<TechnicalGroup | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null);

  const groupsCollectionRef = useMemoFirebase(() => collection(firestore, 'technical-groups'), [firestore]);
  const { data: groups, isLoading: isLoadingGroups } = useCollection<TechnicalGroup>(groupsCollectionRef);

  const usersCollectionRef = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersCollectionRef);

  const groupForm = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: { name: '' },
  });

  const technicianForm = useForm<TechnicianFormValues>({
    resolver: zodResolver(technicianSchema),
    defaultValues: { userId: '' },
  });

  const handleCreateGroup = async (values: GroupFormValues) => {
    setIsSubmitting(true);
    const newGroupData = {
      name: values.name,
      createdAt: new Date().toISOString(),
      technicians: [],
    };
    await addDocumentNonBlocking(collection(firestore, 'technical-groups'), newGroupData);
    toast({ title: "Grupo creado", description: `El grupo "${values.name}" ha sido creado.` });
    setIsSubmitting(false);
    setActiveDialog(null);
    groupForm.reset();
  };
  
  const handleEditGroup = async (values: GroupFormValues) => {
    if (!selectedGroup) return;
    setIsSubmitting(true);
    const groupRef = doc(firestore, 'technical-groups', selectedGroup.id);
    await updateDocumentNonBlocking(groupRef, { name: values.name });
    toast({ title: "Grupo actualizado", description: "El nombre del grupo ha sido cambiado." });
    setIsSubmitting(false);
    setActiveDialog(null);
  }

  const handleAddTechnician = async (values: TechnicianFormValues) => {
    if (!selectedGroup) return;
    setIsSubmitting(true);
    const selectedUser = users?.find(u => u.id === values.userId);
    if (!selectedUser) {
        toast({ variant: "destructive", title: "Error", description: "Usuario no encontrado." });
        setIsSubmitting(false);
        return;
    }

    const groupRef = doc(firestore, 'technical-groups', selectedGroup.id);
    const newTechnician: Technician = {
        userId: selectedUser.id,
        userName: selectedUser.name,
        addedAt: new Date().toISOString(),
    };
    
    await updateDocumentNonBlocking(groupRef, {
        technicians: arrayUnion(newTechnician)
    });

    toast({ title: "Técnico añadido", description: `${selectedUser.name} fue añadido a ${selectedGroup.name}.` });
    setIsSubmitting(false);
    setActiveDialog(null);
    technicianForm.reset();
  };

  const handleRemoveTechnician = async () => {
    if (!selectedGroup || !selectedTechnician) return;
    const groupRef = doc(firestore, 'technical-groups', selectedGroup.id);
    await updateDocumentNonBlocking(groupRef, {
        technicians: arrayRemove(selectedTechnician)
    });
    toast({ title: "Técnico eliminado", description: `${selectedTechnician.userName} fue eliminado de ${selectedGroup.name}.` });
    setActiveDialog(null);
  };
  
  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    const groupRef = doc(firestore, 'technical-groups', selectedGroup.id);
    await deleteDocumentNonBlocking(groupRef);
    toast({ title: "Grupo eliminado", description: `El grupo "${selectedGroup.name}" fue eliminado.` });
    setActiveDialog(null);
  };
  
  if (isLoadingGroups || isLoadingUsers) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Cargando datos...</p>
      </div>
    );
  }

  return (
    <section className="w-full max-w-6xl mx-auto flex flex-col gap-8">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
            <h2 className="text-2xl font-headline font-semibold flex items-center gap-2">
                <Users className="h-6 w-6" />
                Grupos Técnicos
            </h2>
            <p className="text-muted-foreground text-sm">
                Crea y administra grupos de técnicos para organizar el trabajo de campo.
            </p>
        </div>
         <Button onClick={() => setActiveDialog('createGroup')}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Crear Grupo
        </Button>
      </div>
      
      <div className="space-y-6">
        {groups && groups.length > 0 ? (
          groups.sort((a,b) => a.name.localeCompare(b.name)).map(group => (
            <Card key={group.id}>
              <CardHeader className="flex flex-row justify-between items-center">
                  <div>
                    <CardTitle>{group.name}</CardTitle>
                    <CardDescription>{group.technicians.length} técnico(s)</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setSelectedGroup(group); setActiveDialog('addTechnician'); }}>
                          <UserPlus className="mr-2 h-4 w-4"/>
                          Añadir Técnico
                      </Button>
                       <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { groupForm.reset({ name: group.name }); setSelectedGroup(group); setActiveDialog('editGroup'); }}>
                          <Edit className="h-4 w-4"/>
                       </Button>
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/80" onClick={() => { setSelectedGroup(group); setActiveDialog('deleteGroup'); }}>
                          <Trash2 className="h-4 w-4"/>
                       </Button>
                  </div>
              </CardHeader>
              <CardContent>
                {group.technicians.length > 0 ? (
                  <ul className="divide-y">
                    {group.technicians.map(tech => (
                      <li key={tech.userId} className="flex justify-between items-center py-2">
                        <span className="font-medium">{tech.userName}</span>
                        <Button variant="ghost" size="sm" className="text-destructive/80" onClick={() => { setSelectedGroup(group); setSelectedTechnician(tech); setActiveDialog('removeTechnician'); }}>
                            Quitar
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-center text-muted-foreground py-4">No hay técnicos en este grupo.</p>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <h3 className="text-lg font-medium">No hay grupos técnicos</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Crea tu primer grupo para empezar a organizar a tus técnicos.
            </p>
          </div>
        )}
      </div>

       {/* Dialogs */}
      <Dialog open={activeDialog === 'createGroup'} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Crear Nuevo Grupo</DialogTitle></DialogHeader>
          <Form {...groupForm}>
            <form onSubmit={groupForm.handleSubmit(handleCreateGroup)}>
                <div className="py-4">
                  <FormField
                      control={groupForm.control}
                      name="name"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>Nombre del Grupo</FormLabel>
                              <FormControl><Input placeholder="Ej: Equipo Nocturno" {...field} autoFocus /></FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null} Crear
                    </Button>
                </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={activeDialog === 'editGroup'} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Grupo</DialogTitle></DialogHeader>
          <Form {...groupForm}>
            <form onSubmit={groupForm.handleSubmit(handleEditGroup)}>
                <div className="py-4">
                  <FormField
                      control={groupForm.control}
                      name="name"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>Nuevo Nombre del Grupo</FormLabel>
                              <FormControl><Input {...field} autoFocus /></FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null} Guardar
                    </Button>
                </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={activeDialog === 'addTechnician'} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Añadir Técnico a {selectedGroup?.name}</DialogTitle></DialogHeader>
          <Form {...technicianForm}>
            <form onSubmit={technicianForm.handleSubmit(handleAddTechnician)}>
                <div className="py-4">
                  <FormField
                      control={technicianForm.control}
                      name="userId"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>Seleccionar Usuario</FormLabel>
                               <Select onValueChange={field.onChange} value={field.value} defaultValue="">
                                <FormControl>
                                  <SelectTrigger><SelectValue placeholder={"Seleccionar un usuario..."} /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {users?.filter(
                                      user => !selectedGroup?.technicians.some(tech => tech.userId === user.id)
                                  ).map((user) => (
                                      <SelectItem key={user.id} value={user.id}>
                                        {user.name} ({user.email})
                                      </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null} Añadir
                    </Button>
                </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={activeDialog === 'removeTechnician'} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Seguro que quieres quitar a {selectedTechnician?.userName}?</AlertDialogTitle>
                <AlertDialogDescription>
                    Esta acción lo eliminará del grupo "{selectedGroup?.name}". No se puede deshacer.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleRemoveTechnician}>Sí, quitar</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={activeDialog === 'deleteGroup'} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Seguro que quieres eliminar el grupo "{selectedGroup?.name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                    Esta acción eliminará el grupo permanentemente. Los técnicos asignados no serán eliminados.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Sí, eliminar</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </section>
  );
}

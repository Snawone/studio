'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase, useAuthContext } from '@/firebase';
import { collection, doc, arrayUnion, arrayRemove } from 'firebase/firestore';
import {
  Loader2,
  Users,
  PlusCircle,
  Edit,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import {
  type TechnicalGroup,
  type Technician,
  type UserProfile,
} from '@/lib/data';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
} from '@/firebase/non-blocking-updates';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const groupSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
});
type GroupFormValues = z.infer<typeof groupSchema>;

const technicianSchema = z.object({
  userId: z.string().min(1, 'Debes seleccionar un técnico.'),
});
type TechnicianFormValues = z.infer<typeof technicianSchema>;

export function TechnicalGroupsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { profile } = useAuthContext();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isAddTechnicianOpen, setIsAddTechnicianOpen] = useState<string | null>(
    null
  );
  const [groupToEdit, setGroupToEdit] = useState<TechnicalGroup | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<TechnicalGroup | null>(
    null
  );
  const [technicianToRemove, setTechnicianToRemove] = useState<{
    group: TechnicalGroup;
    technician: Technician;
  } | null>(null);

  // Data Hooks
  const groupsRef = useMemoFirebase(
    () => collection(firestore, 'technical-groups'),
    [firestore]
  );
  const { data: groups, isLoading: isLoadingGroups } =
    useCollection<TechnicalGroup>(groupsRef);

  const usersRef = useMemoFirebase(
    () => collection(firestore, 'users'),
    [firestore]
  );
  const { data: users, isLoading: isLoadingUsers } =
    useCollection<UserProfile>(usersRef);

  // Forms
  const groupForm = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
  });

  const technicianForm = useForm<TechnicianFormValues>({
    resolver: zodResolver(technicianSchema),
  });

  // Handlers
  const handleCreateGroup = async (values: GroupFormValues) => {
    setIsSubmitting(true);
    addDocumentNonBlocking(collection(firestore, 'technical-groups'), {
      name: values.name,
      technicians: [],
      createdAt: new Date().toISOString(),
    });
    toast({
      title: 'Grupo Creado',
      description: `El grupo "${values.name}" ha sido creado.`,
    });
    setIsSubmitting(false);
    setIsCreateGroupOpen(false);
    groupForm.reset({ name: '' });
  };

  const handleUpdateGroup = async (values: GroupFormValues) => {
    if (!groupToEdit) return;
    setIsSubmitting(true);
    const groupRef = doc(firestore, 'technical-groups', groupToEdit.id);
    updateDocumentNonBlocking(groupRef, { name: values.name });
    toast({
      title: 'Grupo Actualizado',
      description: 'El nombre del grupo ha sido actualizado.',
    });
    setIsSubmitting(false);
    setGroupToEdit(null);
  };

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;
    const groupRef = doc(firestore, 'technical-groups', groupToDelete.id);
    deleteDocumentNonBlocking(groupRef);
    toast({
      title: 'Grupo Eliminado',
      description: `El grupo "${groupToDelete.name}" ha sido eliminado.`,
    });
    setGroupToDelete(null);
  };

  const handleAddTechnician = async (values: TechnicianFormValues) => {
    if (!isAddTechnicianOpen) return;
    setIsSubmitting(true);
    const groupRef = doc(firestore, 'technical-groups', isAddTechnicianOpen);
    const selectedUser = users?.find(u => u.id === values.userId);

    if (!selectedUser) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Usuario no encontrado.',
      });
      setIsSubmitting(false);
      return;
    }

    const newTechnician: Technician = {
      userId: selectedUser.id,
      userName: selectedUser.name,
      addedAt: new Date().toISOString(),
    };

    updateDocumentNonBlocking(groupRef, {
      technicians: arrayUnion(newTechnician),
    });

    toast({
      title: 'Técnico Añadido',
      description: `${selectedUser.name} ha sido añadido al grupo.`,
    });
    setIsSubmitting(false);
    setIsAddTechnicianOpen(null);
    technicianForm.reset();
  };

  const handleRemoveTechnician = () => {
    if (!technicianToRemove) return;
    const { group, technician } = technicianToRemove;
    const groupRef = doc(firestore, 'technical-groups', group.id);
    updateDocumentNonBlocking(groupRef, {
      technicians: arrayRemove(technician),
    });
    toast({
      title: 'Técnico Eliminado',
      description: `${technician.userName} ha sido eliminado del grupo ${group.name}.`,
    });
    setTechnicianToRemove(null);
  };

  const availableUsersForGroup = (groupId: string) => {
    const group = groups?.find(g => g.id === groupId);
    if (!group || !users) return [];
    const technicianIds = group.technicians.map(t => t.userId);
    return users.filter(u => !technicianIds.includes(u.id));
  };
  
  if (!profile?.isAdmin) {
    return (
       <section className="w-full max-w-4xl mx-auto flex flex-col gap-8">
            <div className="space-y-2">
                <h2 className="text-2xl font-headline font-semibold flex items-center gap-2">
                    <Users className="h-6 w-6" />
                    Acceso Denegado
                </h2>
                <p className="text-muted-foreground text-sm">
                    No tienes permisos para acceder a esta sección.
                </p>
            </div>
       </section>
    )
  }

  if (isLoadingGroups || isLoadingUsers) {
    return (
        <div className="flex h-64 w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-4 text-muted-foreground">Cargando datos...</p>
        </div>
    );
  }

  return (
    <section className="w-full max-w-4xl mx-auto flex flex-col gap-8">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h2 className="text-2xl font-headline font-semibold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Grupos Técnicos
          </h2>
          <p className="text-muted-foreground text-sm">
            Crea grupos y asigna técnicos para organizar tu equipo.
          </p>
        </div>
        <Dialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Crear Grupo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nuevo Grupo</DialogTitle>
            </DialogHeader>
            <Form {...groupForm}>
              <form onSubmit={groupForm.handleSubmit(handleCreateGroup)}>
                <div className="py-4">
                  <FormField
                    control={groupForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre del Grupo</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Equipo Alpha" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="ghost">
                      Cancelar
                    </Button>
                  </DialogClose>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Crear
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Grupos</CardTitle>
          <CardDescription>
            Administra los grupos y los técnicos asignados a cada uno.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingGroups ? (
            <div className="flex justify-center p-8">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : groups && groups.length > 0 ? (
            <div className="space-y-4">
              {groups
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(group => (
                  <Card key={group.id} className="overflow-hidden">
                    <CardHeader className="bg-muted/30 flex-row items-center justify-between p-4">
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">{group.name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Dialog
                          open={isAddTechnicianOpen === group.id}
                          onOpenChange={open =>
                            setIsAddTechnicianOpen(open ? group.id : null)
                          }
                        >
                          <DialogTrigger asChild>
                            <Button size="sm">
                              <UserPlus className="mr-2 h-4 w-4" />
                              Añadir Técnico
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Añadir Técnico a {group.name}</DialogTitle>
                            </DialogHeader>
                            <Form {...technicianForm}>
                              <form onSubmit={technicianForm.handleSubmit(handleAddTechnician)}>
                                <div className="py-4">
                                  <FormField
                                    control={technicianForm.control}
                                    name="userId"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Técnico</FormLabel>
                                        <Select
                                          onValueChange={field.onChange}
                                          defaultValue={field.value}
                                        >
                                          <FormControl>
                                            <SelectTrigger>
                                              <SelectValue placeholder="Seleccionar un usuario..." />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                            {isLoadingUsers ? (
                                              <SelectItem value="loading" disabled>
                                                Cargando...
                                              </SelectItem>
                                            ) : availableUsersForGroup(group.id).length > 0 ? (
                                              availableUsersForGroup(group.id).map(user => (
                                                <SelectItem key={user.id} value={user.id}>
                                                  {user.name} ({user.email})
                                                </SelectItem>
                                              ))
                                            ) : (
                                              <SelectItem value="none" disabled>
                                                No hay usuarios disponibles
                                              </SelectItem>
                                            )}
                                          </SelectContent>
                                        </Select>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <DialogFooter>
                                  <DialogClose asChild>
                                    <Button type="button" variant="ghost">Cancelar</Button>
                                  </DialogClose>
                                  <Button type="submit" disabled={isSubmitting}>
                                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                      Añadir
                                  </Button>
                                </DialogFooter>
                              </form>
                            </Form>
                          </DialogContent>
                        </Dialog>
                        <Button variant="ghost" size="icon" onClick={() => setGroupToEdit(group)}>
                            <Edit className="h-4 w-4" />
                        </Button>
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive/80" onClick={() => setGroupToDelete(group)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar grupo "{groupToDelete?.name}"?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esta acción es permanente. Se eliminará el grupo pero los usuarios permanecerán en el sistema.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteGroup()} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                         </AlertDialog>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4">
                      {group.technicians && group.technicians.length > 0 ? (
                        <ul className="space-y-2">
                          {group.technicians.map(technician => (
                            <li
                              key={technician.userId}
                              className="flex items-center justify-between rounded-md border p-2"
                            >
                              <span className="text-sm font-medium">
                                {technician.userName}
                              </span>
                               <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTechnicianToRemove({group, technician})}>
                                    <X className="h-4 w-4 text-muted-foreground"/>
                               </Button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-center text-muted-foreground py-4">
                          No hay técnicos en este grupo.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
            </div>
          ) : (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground">
                No hay grupos creados. ¡Empieza creando uno!
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Edit Group Dialog */}
      <Dialog open={!!groupToEdit} onOpenChange={(open) => !open && setGroupToEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Grupo</DialogTitle>
          </DialogHeader>
          <Form {...groupForm}>
            <form onSubmit={groupForm.handleSubmit(handleUpdateGroup)}>
              <div className="py-4">
                <FormField
                  control={groupForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nuevo Nombre del Grupo</FormLabel>
                      <FormControl>
                        <Input {...field} defaultValue={groupToEdit?.name} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar Cambios
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Confirm Remove Technician Dialog */}
      <AlertDialog open={!!technicianToRemove} onOpenChange={(open) => !open && setTechnicianToRemove(null)}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>¿Quitar a {technicianToRemove?.technician.userName}?</AlertDialogTitle>
                  <AlertDialogDescription>
                      Se quitará a este técnico del grupo "{technicianToRemove?.group.name}". El usuario no será eliminado del sistema.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRemoveTechnician}>Sí, quitar</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

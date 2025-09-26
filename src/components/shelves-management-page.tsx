
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
import { collection, doc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { Loader2, Warehouse, PlusCircle, Edit, Trash2 } from 'lucide-react';
import { type Shelf } from '@/lib/data';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';


const shelfSchema = z.object({
  name: z.string().min(1, "El nombre es requerido."),
  capacity: z.coerce.number().int().positive("La capacidad debe ser un número positivo."),
  type: z.enum(['onu', 'stb'], { required_error: "Debe seleccionar un tipo." }),
});

type ShelfFormValues = z.infer<typeof shelfSchema>;

function ShelfForm({
  shelf,
  onSubmit,
  onClose,
  isSubmitting,
  submitText,
  isEdit = false,
  itemCount = 0,
}: {
  shelf?: ShelfFormValues;
  onSubmit: (values: any) => void;
  onClose: () => void;
  isSubmitting: boolean;
  submitText: string;
  isEdit?: boolean;
  itemCount?: number;
}) {
  const form = useForm<ShelfFormValues>({
    resolver: zodResolver(shelfSchema),
    defaultValues: shelf || { name: '', capacity: 1, type: 'onu' },
  });
  
  const canChangeType = !isEdit || itemCount === 0;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Estante</FormLabel>
                  <FormControl><Input placeholder="Ej: A1-RACK1" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacidad Máxima</FormLabel>
                  <FormControl><Input type="number" min={itemCount} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contenido</FormLabel>
                   <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={!canChangeType ? 'cursor-not-allowed' : ''}>
                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!canChangeType}>
                              <FormControl>
                                <SelectTrigger><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="onu">ONUs</SelectItem>
                                <SelectItem value="stb">STBs</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TooltipTrigger>
                        {!canChangeType && (
                          <TooltipContent>
                            <p>No se puede cambiar el tipo de un estante con items.</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                   </TooltipProvider>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Guardando...' : submitText}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}


export function ShelvesManagementPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingShelf, setEditingShelf] = useState<Shelf | null>(null);
  const [shelfToDelete, setShelfToDelete] = useState<Shelf | null>(null);

  const shelvesCollectionRef = useMemoFirebase(() => collection(firestore, 'shelves'), [firestore]);
  const { data: shelves, isLoading: isLoadingShelves } = useCollection<Shelf>(shelvesCollectionRef);

  const handleCreateShelf = async (values: ShelfFormValues) => {
    setIsSubmitting(true);
    const newShelfData = {
        ...values,
        itemCount: 0,
        createdAt: new Date().toISOString(),
    };
    
    addDocumentNonBlocking(collection(firestore, 'shelves'), newShelfData);
    toast({ title: "Estante creado", description: `El estante "${values.name}" ha sido creado.` });
    setIsSubmitting(false);
    setIsCreateDialogOpen(false);
  };

  const handleUpdateShelf = async (values: ShelfFormValues) => {
    if (!editingShelf) return;
    setIsSubmitting(true);
    
    const shelfRef = doc(firestore, 'shelves', editingShelf.id);
    
    updateDocumentNonBlocking(shelfRef, {
      name: values.name,
      capacity: values.capacity,
      type: values.type,
    });

    toast({ title: "Estante actualizado", description: `El estante "${values.name}" ha sido actualizado.` });
    setIsSubmitting(false);
    setEditingShelf(null);
  };

  const handleDeleteShelf = async () => {
    if (!shelfToDelete) return;

    const onusCollectionRef = collection(firestore, 'onus');
    const q = query(onusCollectionRef, where("shelfId", "==", shelfToDelete.id));

    try {
        const batch = writeBatch(firestore);
        const querySnapshot = await getDocs(q);
        
        // Delete all ONUs in the shelf
        querySnapshot.forEach((document) => {
            batch.delete(document.ref);
        });

        // Delete the shelf itself
        const shelfRef = doc(firestore, 'shelves', shelfToDelete.id);
        batch.delete(shelfRef);

        await batch.commit();

        toast({
            title: "Estante y contenido eliminados",
            description: `El estante "${shelfToDelete.name}" y sus ${querySnapshot.size} dispositivos han sido eliminados.`,
        });
    } catch (error) {
        console.error("Error eliminando el estante y su contenido:", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "No se pudo completar la eliminación del estante y su contenido.",
        });
    } finally {
        setShelfToDelete(null);
    }
  };
  
  return (
    <section className="w-full max-w-4xl mx-auto flex flex-col gap-8">
       <div className="space-y-2">
        <h2 className="text-2xl font-headline font-semibold flex items-center gap-2">
          <Warehouse className="h-6 w-6" />
          Gestión de Estantes
        </h2>
        <p className="text-muted-foreground text-sm">
          Crea nuevos estantes para organizar tu inventario, edita los existentes o elimínalos.
        </p>
      </div>

      <Card>
          <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Estantes Existentes</CardTitle>
                <CardDescription>Visualiza y administra tus estantes.</CardDescription>
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Crear Estante
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Crear Nuevo Estante</DialogTitle>
                    </DialogHeader>
                    <ShelfForm
                        onSubmit={handleCreateShelf}
                        onClose={() => setIsCreateDialogOpen(false)}
                        isSubmitting={isSubmitting}
                        submitText="Crear Estante"
                    />
                </DialogContent>
              </Dialog>
          </CardHeader>
          <CardContent>
          <TooltipProvider>
          {isLoadingShelves ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="animate-spin text-muted-foreground"/>
                    </div>
                ) : shelves && shelves.length > 0 ? (
                    <div className="border rounded-md">
                        {shelves.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map((shelf, index) => (
                            <div key={shelf.id} className={`flex justify-between items-center p-3 ${index < shelves.length -1 ? 'border-b' : ''}`}>
                                <div>
                                    <p className="font-medium">{shelf.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {shelf.itemCount}/{shelf.capacity} {shelf.type.toUpperCase()}s
                                    </p>
                                </div>
                                <div className='flex items-center gap-1'>
                                    <Button variant="ghost" size="icon" onClick={() => setEditingShelf(shelf)}>
                                        <Edit className="h-4 w-4"/>
                                        <span className="sr-only">Editar estante {shelf.name}</span>
                                    </Button>
                                    <AlertDialog onOpenChange={(open) => !open && setShelfToDelete(null)}>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={() => setShelfToDelete(shelf)}>
                                                <Trash2 className="h-4 w-4 text-destructive/80"/>
                                                <span className="sr-only">Eliminar estante {shelf.name}</span>
                                            </Button>
                                        </AlertDialogTrigger>
                                      <AlertDialogContent>
                                          <AlertDialogHeader>
                                              <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                                              <AlertDialogDescription>
                                                  Esta acción es permanente y no se puede deshacer. Se eliminará el estante <strong>{shelfToDelete?.name}</strong> y los <strong>{shelfToDelete?.itemCount} dispositivos</strong> que contiene.
                                              </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                              <AlertDialogAction 
                                                className="bg-destructive hover:bg-destructive/90"
                                                onClick={handleDeleteShelf}>
                                                  Sí, eliminar todo
                                              </AlertDialogAction>
                                          </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-sm text-muted-foreground py-8">
                        No hay estantes creados. Haz clic en "Crear Estante" para empezar.
                    </p>
                )}
            </TooltipProvider>
          </CardContent>
      </Card>

      {/* Edit Shelf Dialog */}
      <Dialog open={!!editingShelf} onOpenChange={(open) => !open && setEditingShelf(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Estante: {editingShelf?.name}</DialogTitle>
            <DialogDescription>
              Modifica el nombre, capacidad o tipo del estante. El tipo solo se puede cambiar si el estante está vacío.
            </DialogDescription>
          </DialogHeader>
            <ShelfForm
                shelf={editingShelf ? { name: editingShelf.name, capacity: editingShelf.capacity, type: editingShelf.type } : undefined}
                onSubmit={handleUpdateShelf}
                onClose={() => setEditingShelf(null)}
                isSubmitting={isSubmitting}
                submitText="Guardar Cambios"
                isEdit={true}
                itemCount={editingShelf?.itemCount}
            />
        </DialogContent>
      </Dialog>
    </section>
  );
}

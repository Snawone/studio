
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
import { collection } from 'firebase/firestore';
import { Loader2, Warehouse, PlusCircle, Edit } from 'lucide-react';
import { type Shelf } from '@/lib/data';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { doc } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";

const shelfSchema = z.object({
  name: z.string().min(1, "El nombre es requerido."),
  capacity: z.coerce.number().int().positive("La capacidad debe ser un número positivo."),
  type: z.enum(['onu', 'stb'], { required_error: "Debe seleccionar un tipo." }),
});

type ShelfFormValues = z.infer<typeof shelfSchema>;

// Reusable Shelf Form Component
function ShelfForm({
  shelf,
  onSubmit,
  isSubmitting,
  submitText,
  isEdit = false,
}: {
  shelf?: ShelfFormValues;
  onSubmit: (values: any) => void;
  isSubmitting: boolean;
  submitText: string;
  isEdit?: boolean;
}) {
  const form = useForm<ShelfFormValues>({
    resolver: zodResolver(shelfSchema),
    defaultValues: shelf || { name: '', capacity: 1, type: 'onu' },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-4">
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
                  <FormControl><Input type="number" min="1" {...field} /></FormControl>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isEdit}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="onu">ONUs</SelectItem>
                      <SelectItem value="stb">STBs</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <PlusCircle className="mr-2 h-4 w-4" />
                {isSubmitting ? 'Guardando...' : submitText}
            </Button>
        </div>
      </form>
    </Form>
  );
}


export function ShelvesManagementPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isCreatingShelf, setIsCreatingShelf] = useState(false);
  const [isUpdatingShelf, setIsUpdatingShelf] = useState(false);
  const [editingShelf, setEditingShelf] = useState<Shelf | null>(null);

  const shelvesCollectionRef = useMemoFirebase(() => collection(firestore, 'shelves'), [firestore]);
  const { data: shelves, isLoading: isLoadingShelves } = useCollection<Shelf>(shelvesCollectionRef);

  const handleCreateShelf = async (values: ShelfFormValues) => {
    setIsCreatingShelf(true);
    const newShelfData = {
        ...values,
        itemCount: 0,
        createdAt: new Date().toISOString(),
    };
    
    addDocumentNonBlocking(collection(firestore, 'shelves'), newShelfData)
      .then(() => {
        toast({ title: "Estante creado", description: `El estante "${values.name}" ha sido creado.` });
      })
      .catch((error) => {
        console.error("Error creating shelf: ", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo crear el estante. Revisa los permisos." });
      })
      .finally(() => {
          setIsCreatingShelf(false);
      });
  };

  const handleUpdateShelf = async (values: Pick<ShelfFormValues, 'name' | 'capacity'>) => {
    if (!editingShelf) return;
    setIsUpdatingShelf(true);
    
    const shelfRef = doc(firestore, 'shelves', editingShelf.id);
    
    updateDocumentNonBlocking(shelfRef, {
      name: values.name,
      capacity: values.capacity
    });

    toast({ title: "Estante actualizado", description: `El estante "${values.name}" ha sido actualizado.` });
    setIsUpdatingShelf(false);
    setEditingShelf(null);
  };
  
  return (
    <section className="w-full max-w-4xl mx-auto flex flex-col gap-8">
       <div className="space-y-2">
        <h2 className="text-2xl font-headline font-semibold flex items-center gap-2">
          <Warehouse className="h-6 w-6" />
          Gestión de Estantes
        </h2>
        <p className="text-muted-foreground text-sm">
          Crea nuevos estantes para organizar tu inventario y edita los existentes.
        </p>
      </div>

      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">Crear Nuevo Estante</CardTitle>
        </CardHeader>
        <CardContent>
          <ShelfForm
              onSubmit={handleCreateShelf}
              isSubmitting={isCreatingShelf}
              submitText="Crear Estante"
          />
        </CardContent>
      </Card>
      
      <Card>
          <CardHeader>
              <CardTitle>Estantes Existentes</CardTitle>
          </CardHeader>
          <CardContent>
          {isLoadingShelves ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="animate-spin text-muted-foreground"/>
                    </div>
                ) : shelves && shelves.length > 0 ? (
                    <div className="border rounded-md">
                        {shelves.map((shelf, index) => (
                            <div key={shelf.id} className={`flex justify-between items-center p-3 ${index < shelves.length -1 ? 'border-b' : ''}`}>
                                <div>
                                    <p className="font-medium">{shelf.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {shelf.itemCount}/{shelf.capacity} {shelf.type.toUpperCase()}s
                                    </p>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setEditingShelf(shelf)}>
                                    <Edit className="h-4 w-4"/>
                                    <span className="sr-only">Editar estante {shelf.name}</span>
                                </Button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-sm text-muted-foreground py-8">
                        No hay estantes creados.
                    </p>
                )}
          </CardContent>
      </Card>

      {/* Edit Shelf Dialog */}
      <Dialog open={!!editingShelf} onOpenChange={(open) => !open && setEditingShelf(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Estante</DialogTitle>
            <DialogDescription>
              Modifica el nombre y la capacidad del estante. El tipo no se puede cambiar.
            </DialogDescription>
          </DialogHeader>
          <div className="pt-4">
            <ShelfForm
                shelf={editingShelf ? { name: editingShelf.name, capacity: editingShelf.capacity, type: editingShelf.type } : undefined}
                onSubmit={handleUpdateShelf}
                isSubmitting={isUpdatingShelf}
                submitText="Guardar Cambios"
                isEdit={true}
            />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}


'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { addDoc, collection, doc, getDoc, writeBatch } from 'firebase/firestore';
import { PackagePlus, Loader2, AlertTriangle, Server } from 'lucide-react';
import { type Shelf, type OnuData } from '@/lib/data';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';


const deviceSchema = z.object({
  id: z.string().min(1, "El ID del dispositivo es requerido."),
  shelfId: z.string().min(1, "Debe seleccionar un estante."),
});

type DeviceFormValues = z.infer<typeof deviceSchema>;

export function StockManagementPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isAddingDevice, setIsAddingDevice] = useState(false);

  const shelvesCollectionRef = useMemoFirebase(() => collection(firestore, 'shelves'), [firestore]);
  const { data: shelves, isLoading: isLoadingShelves } = useCollection<Shelf>(shelvesCollectionRef);

  const deviceForm = useForm<DeviceFormValues>({
    resolver: zodResolver(deviceSchema),
    defaultValues: { id: '', shelfId: '' },
  });

  const handleAddDevice = async (values: DeviceFormValues) => {
    setIsAddingDevice(true);
    const selectedShelf = shelves?.find(s => s.id === values.shelfId);
    if (!selectedShelf) {
        toast({ variant: "destructive", title: "Error", description: "El estante seleccionado no es válido." });
        setIsAddingDevice(false);
        return;
    }

    if(selectedShelf.itemCount >= selectedShelf.capacity) {
        toast({ variant: "destructive", title: "Estante lleno", description: `El estante "${selectedShelf.name}" ha alcanzado su capacidad máxima.` });
        setIsAddingDevice(false);
        return;
    }

    const deviceRef = doc(firestore, 'onus', values.id);
    const shelfRef = doc(firestore, 'shelves', values.shelfId);

    try {
        const deviceDoc = await getDoc(deviceRef);
        if (deviceDoc.exists()) {
            throw new Error("Ya existe un dispositivo con este ID en el inventario.");
        }
        
        const batch = writeBatch(firestore);
        
        const addedDate = new Date().toISOString();
        const newDevice: Omit<OnuData, 'id'> = {
            'ONU ID': values.id,
            shelfId: values.shelfId,
            shelfName: selectedShelf.name,
            addedDate: addedDate,
            status: 'active',
            history: [{ action: 'created', date: addedDate, source: 'manual' }],
        };

        batch.set(deviceRef, newDevice);
        batch.update(shelfRef, { itemCount: selectedShelf.itemCount + 1 });
        
        await batch.commit();

        toast({ title: "Dispositivo agregado", description: `Dispositivo "${values.id}" agregado al estante "${selectedShelf.name}".` });
        
        deviceForm.reset({
            id: '',
            shelfId: values.shelfId,
        });

    } catch (error: any) {
        console.error("Error adding device: ", error);
        toast({ variant: "destructive", title: "Error al agregar", description: error.message });
    } finally {
        setIsAddingDevice(false);
    }
  };

  return (
    <section className="w-full max-w-4xl mx-auto flex flex-col gap-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-headline font-semibold flex items-center gap-2">
          <PackagePlus className="h-6 w-6" />
          Cargar Dispositivos
        </h2>
        <p className="text-muted-foreground text-sm">
          Agrega nuevos dispositivos (ONUs/STBs) al inventario en un estante existente.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5 text-primary"/>Cargar Dispositivo</CardTitle>
          <CardDescription>
            Agrega una nueva ONU o STB a un estante existente.
          </CardDescription>
        </CardHeader>
        {isLoadingShelves ? (
            <CardContent><Loader2 className="animate-spin"/></CardContent>
        ) : !shelves || shelves.length === 0 ? (
            <CardContent>
                <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/50">
                    <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground" />
                    <h3 className="mt-4 text-base font-medium">No hay estantes creados</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Debes crear al menos un estante en la sección 'Estantes' para poder agregar dispositivos.
                    </p>
                </div>
            </CardContent>
        ) : (
          <Form {...deviceForm}>
            <form onSubmit={deviceForm.handleSubmit(handleAddDevice)}>
              <CardContent className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={deviceForm.control}
                      name="id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ID del Dispositivo</FormLabel>
                          <FormControl><Input placeholder="Ej: 2430011054007532" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={deviceForm.control}
                      name="shelfId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estante</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} defaultValue="">
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Seleccionar estante..." /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {shelves.map((shelf) => (
                                  <SelectItem key={shelf.id} value={shelf.id} disabled={shelf.itemCount >= shelf.capacity}>
                                    {shelf.name} ({shelf.itemCount}/{shelf.capacity} {shelf.type.toUpperCase()}s)
                                  </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isAddingDevice}>
                    {isAddingDevice && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <PackagePlus className="mr-2 h-4 w-4"/>
                    {isAddingDevice ? 'Agregando...' : 'Agregar Dispositivo'}
                </Button>
              </CardFooter>
            </form>
          </Form>
        )}
      </Card>
    </section>
  );
}

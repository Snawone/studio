
'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { doc, getDocs, writeBatch, collection, query, where, documentId } from 'firebase/firestore';
import { PackagePlus, Loader2, AlertTriangle, Server, Box } from 'lucide-react';
import { type Shelf, type OnuData, type OnuHistoryEntry } from '@/lib/data';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuthContext } from '@/firebase/auth/auth-provider';


const deviceSchema = z.object({
  ids: z.string().min(1, "Debe ingresar al menos un ID de dispositivo."),
  shelfId: z.string().min(1, "Debe seleccionar un estante."),
  type: z.enum(['onu', 'stb'], { required_error: "Debe seleccionar un tipo." }),
});

type DeviceFormValues = z.infer<typeof deviceSchema>;

export function StockManagementPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { profile } = useAuthContext();
  const [isAddingDevice, setIsAddingDevice] = useState(false);

  const shelvesCollectionRef = useMemoFirebase(() => collection(firestore, 'shelves'), [firestore]);
  const { data: allShelves, isLoading: isLoadingShelves } = useCollection<Shelf>(shelvesCollectionRef);

  const deviceForm = useForm<DeviceFormValues>({
    resolver: zodResolver(deviceSchema),
    defaultValues: { ids: '', shelfId: '', type: undefined },
  });

  const selectedType = deviceForm.watch('type');

  const filteredShelves = useMemo(() => {
    if (!allShelves || !selectedType) {
      return [];
    }
    return allShelves.filter(shelf => shelf.type === selectedType);
  }, [allShelves, selectedType]);

  const handleAddDevices = async (values: DeviceFormValues) => {
    setIsAddingDevice(true);
    
    if (!profile) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo identificar al usuario." });
      setIsAddingDevice(false);
      return;
    }

    const selectedShelf = allShelves?.find(s => s.id === values.shelfId);
    if (!selectedShelf) {
        toast({ variant: "destructive", title: "Error", description: "El estante seleccionado no es válido." });
        setIsAddingDevice(false);
        return;
    }

    const deviceIds = values.ids.split(/[\s,;\n]+/).map(id => id.trim()).filter(id => id.length > 0);
    const uniqueDeviceIds = [...new Set(deviceIds)];

    if (uniqueDeviceIds.length === 0) {
        toast({ variant: "destructive", title: "Error", description: "No se ingresaron IDs válidos." });
        setIsAddingDevice(false);
        return;
    }

    if((selectedShelf.itemCount + uniqueDeviceIds.length) > selectedShelf.capacity) {
        toast({ 
            variant: "destructive", 
            title: "Capacidad excedida", 
            description: `El estante "${selectedShelf.name}" no tiene suficiente espacio para ${uniqueDeviceIds.length} dispositivos.` 
        });
        setIsAddingDevice(false);
        return;
    }

    const onusRef = collection(firestore, 'onus');
    const q = query(onusRef, where(documentId(), 'in', uniqueDeviceIds));
    
    try {
        const existingDevicesSnapshot = await getDocs(q);
        const existingIds = existingDevicesSnapshot.docs.map(doc => doc.id);

        if (existingIds.length > 0) {
            throw new Error(`Los siguientes IDs ya existen: ${existingIds.join(', ')}`);
        }
        
        const batch = writeBatch(firestore);
        const addedDate = new Date().toISOString();
        
        const historyEntry: OnuHistoryEntry = {
            action: 'created',
            date: addedDate,
            source: 'manual',
            userId: profile.id,
            userName: profile.name,
        };

        uniqueDeviceIds.forEach(deviceId => {
            const deviceRef = doc(firestore, 'onus', deviceId);
            const newDevice: Omit<OnuData, 'id'> = {
                'ONU ID': deviceId,
                shelfId: values.shelfId,
                shelfName: selectedShelf.name,
                type: values.type,
                addedDate: addedDate,
                status: 'active',
                history: [historyEntry],
            };
            batch.set(deviceRef, newDevice);
        });
        
        const shelfRef = doc(firestore, 'shelves', values.shelfId);
        batch.update(shelfRef, { itemCount: selectedShelf.itemCount + uniqueDeviceIds.length });
        
        await batch.commit();

        toast({ title: "Dispositivos agregados", description: `${uniqueDeviceIds.length} dispositivo(s) agregados al estante "${selectedShelf.name}".` });
        
        deviceForm.reset({
            ids: '',
            shelfId: '',
            type: values.type
        });

    } catch (error: any) {
        console.error("Error adding devices: ", error);
        toast({ variant: "destructive", title: "Error al agregar", description: error.message });
    } finally {
        setIsAddingDevice(false);
        deviceForm.setFocus('ids');
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
          <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5 text-primary"/>Carga Individual o Masiva</CardTitle>
          <CardDescription>
            Ingresa uno o varios IDs de dispositivo separados por espacios, comas o saltos de línea.
          </CardDescription>
        </CardHeader>
        {isLoadingShelves ? (
            <CardContent><Loader2 className="animate-spin"/></CardContent>
        ) : !allShelves || allShelves.length === 0 ? (
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
            <form onSubmit={deviceForm.handleSubmit(handleAddDevices)}>
              <CardContent className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={deviceForm.control}
                      name="ids"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IDs de Dispositivos</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="2430011054007532 2430011054007533..." 
                              className="h-32"
                              {...field} 
                              autoFocus 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className='space-y-4'>
                    <FormField
                      control={deviceForm.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Dispositivo</FormLabel>
                          <Select onValueChange={(value) => {
                              field.onChange(value)
                              deviceForm.setValue('shelfId', '');
                            }} 
                            value={field.value} defaultValue="">
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="onu">ONU</SelectItem>
                              <SelectItem value="stb">STB</SelectItem>
                            </SelectContent>
                          </Select>
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
                          <Select onValueChange={field.onChange} value={field.value} defaultValue="" disabled={!selectedType}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder={selectedType ? "Seleccionar estante..." : "Primero elije un tipo"} /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {filteredShelves.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map((shelf) => (
                                  <SelectItem key={shelf.id} value={shelf.id} disabled={shelf.itemCount >= shelf.capacity}>
                                    {shelf.name} ({shelf.itemCount}/{shelf.capacity})
                                  </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isAddingDevice}>
                    {isAddingDevice && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <PackagePlus className="mr-2 h-4 w-4"/>
                    {isAddingDevice ? 'Agregando...' : 'Agregar Dispositivos'}
                </Button>
              </CardFooter>
            </form>
          </Form>
        )}
      </Card>
    </section>
  );
}

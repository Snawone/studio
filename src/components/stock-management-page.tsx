'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { doc, getDocs, writeBatch, collection, query, where, documentId, increment, deleteDoc } from 'firebase/firestore';
import { PackagePlus, Loader2, AlertTriangle, Server, Box, History, User, Calendar, ClipboardList, Search, Move, Trash2, XCircle } from 'lucide-react';
import { type Shelf, type OnuData, type OnuHistoryEntry } from '@/lib/data';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuthContext } from '@/firebase/auth/auth-provider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const deviceSchema = z.object({
  ids: z.string().min(1, "Debe ingresar al menos un ID de dispositivo."),
  shelfId: z.string().min(1, "Debe seleccionar un estante."),
  type: z.enum(['onu', 'stb'], { required_error: "Debe seleccionar un tipo." }),
});

type DeviceFormValues = z.infer<typeof deviceSchema>;

interface StockManagementPageProps {
  allOnus: OnuData[];
  allShelves: Shelf[];
}

type LoadEvent = {
  key: string;
  date: string;
  userName: string;
  shelfName: string;
  count: number;
  deviceIds: string[];
}

const DeviceRow = ({ device, allShelves, onMove, onDelete }: { device: OnuData, allShelves: Shelf[], onMove: (device: OnuData, newShelfId: string) => void, onDelete: (device: OnuData) => void }) => {
    const [targetShelfId, setTargetShelfId] = useState<string | null>(null);
    const [isMoving, setIsMoving] = useState(false);
    
    const availableShelvesForMove = useMemo(() => {
        return allShelves.filter(shelf => 
            shelf.id !== device.shelfId &&
            shelf.type === device.type &&
            shelf.itemCount < shelf.capacity
        );
    }, [device, allShelves]);

    const handleMoveClick = async () => {
        if (!targetShelfId) return;
        setIsMoving(true);
        await onMove(device, targetShelfId);
        setIsMoving(false);
    };

    return (
        <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
            <div>
                <h4 className="font-semibold font-mono text-sm break-all">{device.id}</h4>
                <p className="text-xs text-muted-foreground">Tipo: {device.type.toUpperCase()}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div className="flex items-end gap-2">
                    <div className="flex-grow">
                        <Label htmlFor={`move-shelf-${device.id}`} className="text-xs">Mover a Nuevo Estante</Label>
                        <Select onValueChange={setTargetShelfId} disabled={availableShelvesForMove.length === 0}>
                            <SelectTrigger id={`move-shelf-${device.id}`}>
                                <SelectValue placeholder={availableShelvesForMove.length > 0 ? "Seleccionar..." : "No hay estantes"} />
                            </SelectTrigger>
                            <SelectContent>
                                {availableShelvesForMove.map(shelf => (
                                    <SelectItem key={shelf.id} value={shelf.id}>
                                        {shelf.name} ({shelf.itemCount}/{shelf.capacity})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handleMoveClick} disabled={!targetShelfId || isMoving} size="icon">
                        {isMoving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Move className="h-4 w-4"/>}
                    </Button>
                </div>
                <div className="flex justify-end items-end h-full">
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta acción es permanente. El dispositivo <strong className="font-mono break-all">{device.id}</strong> será eliminado del inventario y no se podrá recuperar.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDelete(device)} className="bg-destructive hover:bg-destructive/90">
                                    Sí, eliminar permanentemente
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>
        </div>
    );
};


export function StockManagementPage({ allOnus, allShelves }: StockManagementPageProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { profile } = useAuthContext();
  const [isAddingDevice, setIsAddingDevice] = useState(false);
  
  const [managementSearchTerm, setManagementSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [filterShelfId, setFilterShelfId] = useState<string | null>(null);

  const [foundDevice, setFoundDevice] = useState<OnuData | null>(null);
  const [shelfDevices, setShelfDevices] = useState<OnuData[]>([]);

  const deviceForm = useForm<DeviceFormValues>({
    resolver: zodResolver(deviceSchema),
    defaultValues: { ids: '', shelfId: '', type: undefined },
  });

  useEffect(() => {
    setFoundDevice(null);
    setSearchError(null);
    if (filterShelfId) {
      const devices = allOnus.filter(onu => onu.shelfId === filterShelfId);
      setShelfDevices(devices);
    } else {
      setShelfDevices([]);
    }
  }, [filterShelfId, allOnus]);


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
                shelfId: values.shelfId,
                shelfName: selectedShelf.name,
                type: values.type,
                addedDate: addedDate,
                status: 'active',
                history: [historyEntry],
            };
            batch.set(deviceRef, {id: deviceId, ...newDevice});
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

  const handleSearchDevice = () => {
    if (!managementSearchTerm.trim()) {
        setFoundDevice(null);
        setSearchError(null);
        setFilterShelfId(null);
        return;
    }
    setIsSearching(true);
    setSearchError(null);
    setFilterShelfId(null);
    setShelfDevices([]);

    const device = allOnus.find(d => d.id === managementSearchTerm.trim());
    
    setTimeout(() => {
        if (device) {
            setFoundDevice(device);
        } else {
            setFoundDevice(null);
            setSearchError("No se encontró ningún dispositivo con ese ID.");
        }
        setIsSearching(false);
    }, 500);
  };
  
  const handleMoveDevice = async (deviceToMove: OnuData, newShelfId: string) => {
    if (!profile) return;
    
    const originalShelf = allShelves.find(s => s.id === deviceToMove.shelfId);
    const newShelf = allShelves.find(s => s.id === newShelfId);

    if (!originalShelf || !newShelf) {
        toast({ variant: "destructive", title: "Error", description: "Estante no encontrado." });
        return;
    }
    
    const batch = writeBatch(firestore);
    
    const onuRef = doc(firestore, 'onus', deviceToMove.id);
    const historyEntry: OnuHistoryEntry = {
        action: 'restored',
        date: new Date().toISOString(),
        userId: profile.id,
        userName: profile.name,
        description: `Dispositivo movido del estante ${originalShelf.name} a ${newShelf.name}.`
    };
    batch.update(onuRef, {
        shelfId: newShelf.id,
        shelfName: newShelf.name,
        history: [...(deviceToMove.history || []), historyEntry]
    });
    
    const oldShelfRef = doc(firestore, 'shelves', originalShelf.id);
    batch.update(oldShelfRef, { itemCount: increment(-1) });
    
    const newShelfRef = doc(firestore, 'shelves', newShelf.id);
    batch.update(newShelfRef, { itemCount: increment(1) });
    
    await batch.commit();

    toast({ title: "Dispositivo movido", description: `${deviceToMove.id} movido a ${newShelf.name}.`});

    // Reset view
    if (foundDevice) setFoundDevice(null);
    if (filterShelfId) setFilterShelfId(filterShelfId); // Re-trigger filter effect
  };
  
  const handleDeleteDevice = async (deviceToDelete: OnuData) => {
    const batch = writeBatch(firestore);

    const deviceRef = doc(firestore, 'onus', deviceToDelete.id);
    batch.delete(deviceRef);

    const shelfRef = doc(firestore, 'shelves', deviceToDelete.shelfId);
    batch.update(shelfRef, { itemCount: increment(-1) });

    await batch.commit();
    
    toast({ variant: 'destructive', title: "Dispositivo Eliminado", description: `El dispositivo ${deviceToDelete.id} ha sido eliminado permanentemente.`});

    // Reset view
    if (foundDevice) setFoundDevice(null);
    if (filterShelfId) setFilterShelfId(filterShelfId); // Re-trigger filter effect
  };

  const loadHistory = useMemo(() => {
    const events: Record<string, LoadEvent> = {};
    
    allOnus.forEach(onu => {
        const createEntry = onu.history.find(h => h.action === 'created');
        if (createEntry && createEntry.userName) {
            const key = `${createEntry.date}-${createEntry.userName}-${onu.shelfName}`;
            if (events[key]) {
                events[key].count++;
                events[key].deviceIds.push(onu.id);
            } else {
                events[key] = {
                    key,
                    date: createEntry.date,
                    userName: createEntry.userName,
                    shelfName: onu.shelfName,
                    count: 1,
                    deviceIds: [onu.id]
                };
            }
        }
    });

    return Object.values(events).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allOnus]);

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), "dd/MM/yyyy, HH:mm", { locale: es });
    } catch (e) {
      return 'Fecha inválida';
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
        {!allShelves || allShelves.length === 0 ? (
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
              <CardContent>
                 <div className="space-y-4">
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
                    <FormField
                      control={deviceForm.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Dispositivo</FormLabel>
                          <Select onValueChange={field.onChange} 
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
                          <Select onValueChange={field.onChange} value={field.value} defaultValue="">
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder={"Seleccionar estante..."} /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {(allShelves || []).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map((shelf) => (
                                  <SelectItem key={shelf.id} value={shelf.id} disabled={shelf.itemCount >= shelf.capacity}>
                                    {shelf.name} ({shelf.itemCount}/{shelf.capacity}) - {shelf.type.toUpperCase()}
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
                    {isAddingDevice ? 'Agregando...' : 'Agregar Dispositivos'}
                </Button>
              </CardFooter>
            </form>
          </Form>
        )}
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'><History className="h-5 w-5 text-primary"/>Historial de Cargas</CardTitle>
          <CardDescription>Registro de lotes de dispositivos agregados al inventario.</CardDescription>
        </CardHeader>
        <CardContent>
            {loadHistory.length > 0 ? (
                <ScrollArea className="h-72">
                    <div className='space-y-4'>
                        {loadHistory.map((event) => (
                           <div key={event.key} className="p-4 border rounded-lg flex justify-between items-center">
                                <div>
                                    <div className="font-semibold">{event.count} dispositivos a <span className='text-primary'>{event.shelfName}</span></div>
                                    <div className='text-sm text-muted-foreground flex items-center gap-4 mt-1'>
                                        <span className='flex items-center gap-1'><Calendar className="h-4 w-4"/> {formatDate(event.date)}</span>
                                        <span className='flex items-center gap-1'><User className="h-4 w-4"/> {event.userName}</span>
                                    </div>
                                </div>
                                <div>
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm">
                                                <ClipboardList className="mr-2 h-4 w-4"/>
                                                Ver IDs
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>IDs Cargados</DialogTitle>
                                                <DialogDescription>
                                                    {event.count} dispositivos cargados a {event.shelfName} el {formatDate(event.date)}.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <ScrollArea className="h-60 mt-4 border rounded-md p-4">
                                                <div className="flex flex-col gap-2 font-mono text-sm">
                                                    {event.deviceIds.map(id => <span key={id}>{id}</span>)}
                                                </div>
                                            </ScrollArea>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                           </div>
                        ))}
                    </div>
                </ScrollArea>
            ) : (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                    <p className="text-sm text-muted-foreground">No hay historial de cargas todavía.</p>
                </div>
            )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'><Move className="h-5 w-5 text-primary"/>Gestión Individual de Dispositivos</CardTitle>
          <CardDescription>Busca un dispositivo por su ID o filtra por estante para moverlo o eliminarlo del inventario.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex flex-col sm:flex-row gap-2 w-full flex-wrap">
                  <div className="relative flex-grow w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por ID de dispositivo..."
                      value={managementSearchTerm}
                      onChange={(e) => setManagementSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchDevice()}
                      className="pl-10"
                    />
                  </div>
                  <Button onClick={handleSearchDevice} disabled={isSearching || !managementSearchTerm} className="shrink-0">
                    {isSearching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Buscar
                  </Button>
              </div>
            
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Label htmlFor="shelf-filter" className="text-sm shrink-0">o Filtrar:</Label>
                <div className="w-full">
                  <Select onValueChange={(value) => setFilterShelfId(value === 'none' ? null : value)} value={filterShelfId || 'none'}>
                      <SelectTrigger id="shelf-filter" className="w-full">
                          <SelectValue placeholder="Seleccionar estante..." />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="none">-- Ninguno --</SelectItem>
                          {allShelves.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(shelf => (
                              <SelectItem key={shelf.id} value={shelf.id}>
                                  {shelf.name}
                              </SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          
          <div className="pt-4 space-y-4">
            {isSearching && <div className="text-center p-4"><Loader2 className="animate-spin text-primary"/></div>}

            {searchError && (
                <div className="text-center p-4 text-sm text-destructive">{searchError}</div>
            )}
            
            {foundDevice && (
                <DeviceRow 
                    device={foundDevice} 
                    allShelves={allShelves} 
                    onMove={handleMoveDevice}
                    onDelete={handleDeleteDevice}
                />
            )}

            {shelfDevices.length > 0 && (
                <div className='space-y-4'>
                    <h4 className="font-semibold text-center md:text-left">
                        {shelfDevices.length} dispositivo(s) en el estante {allShelves.find(s => s.id === filterShelfId)?.name}
                    </h4>
                    <ScrollArea className="h-96">
                        <div className='space-y-2 pr-4'>
                            {shelfDevices.map(device => (
                                <DeviceRow 
                                    key={device.id}
                                    device={device} 
                                    allShelves={allShelves} 
                                    onMove={handleMoveDevice}
                                    onDelete={handleDeleteDevice}
                                />
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

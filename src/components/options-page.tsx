
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Settings, FileDown, UploadCloud, File, X, Loader2, Warehouse, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { OnuData, Shelf, OnuHistoryEntry } from "@/lib/data";
import { useDropzone } from 'react-dropzone';
import { useFirestore, useCollection } from "@/firebase";
import { useAuthContext } from '@/firebase/auth/auth-provider';
import { writeBatch, collection, doc, increment } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

interface OptionsPageProps {
  allOnus: OnuData[];
  allShelves: Shelf[];
}

type DeviceStatus = 'new' | 'existing_moved' | 'existing_duplicate';

type PreviewDevice = {
  id: string;
  status: DeviceStatus;
  currentShelfName?: string;
};

type PreviewData = {
  shelfName: string;
  isNewShelf: boolean;
  devices: PreviewDevice[];
  type: 'onu' | 'stb';
  capacity: number;
}

export function OptionsPage({ allOnus, allShelves }: OptionsPageProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { profile } = useAuthContext();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData[]>([]);
  const [importMode, setImportMode] = useState<'add_only' | 'overwrite'>('add_only');


  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
  });

  const handlePreview = async () => {
    if (!file) return;

    setIsProcessing(true);
    toast({ title: 'Procesando archivo...', description: 'Analizando el archivo y comparando con el inventario actual.' });

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result;
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data: (string | number)[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (data.length < 2) throw new Error("El archivo Excel está vacío o no tiene el formato correcto.");
        
        const headers = data[0] as string[];
        const deviceRows = data.slice(1);
        
        const parsedData: PreviewData[] = [];

        headers.forEach((shelfName, colIndex) => {
          if (!shelfName || typeof shelfName !== 'string' || shelfName.trim() === '') return;
          
          const trimmedShelfName = shelfName.trim();
          const existingShelf = allShelves.find(s => s.name === trimmedShelfName);
          const devicesInSheet = deviceRows.map(row => row[colIndex]).filter(id => id).map(id => String(id).trim());

          if (devicesInSheet.length > 0) {
            const processedDevices: PreviewDevice[] = devicesInSheet.map(deviceId => {
              const existingDevice = allOnus.find(onu => onu.id === deviceId);
              if (!existingDevice) {
                return { id: deviceId, status: 'new' };
              }
              if (existingDevice.shelfName === trimmedShelfName) {
                return { id: deviceId, status: 'existing_duplicate' };
              }
              return { id: deviceId, status: 'existing_moved', currentShelfName: existingDevice.shelfName };
            });

            parsedData.push({
              shelfName: trimmedShelfName,
              isNewShelf: !existingShelf,
              devices: processedDevices,
              type: existingShelf?.type || 'onu', // Default to existing shelf type or 'onu'
              capacity: devicesInSheet.length,
            });
          }
        });

        if (parsedData.length === 0) throw new Error("No se encontraron datos válidos para importar en el archivo.");

        setPreviewData(parsedData);
        setIsPreviewOpen(true);

      } catch (error: any) {
        console.error("Error al previsualizar:", error);
        toast({ variant: 'destructive', title: 'Error al leer el archivo', description: error.message || 'No se pudo procesar el archivo Excel.' });
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDeviceTypeChange = (shelfName: string, newType: 'onu' | 'stb') => {
    setPreviewData(currentData => 
        currentData.map(shelf => 
            shelf.shelfName === shelfName ? { ...shelf, type: newType } : shelf
        )
    );
  };
  
  const handleConfirmImport = async () => {
    if (previewData.length === 0 || !profile) return;

    setIsProcessing(true);
    toast({ title: 'Iniciando importación...', description: 'Este proceso puede tardar unos momentos.' });

    try {
        const batch = writeBatch(firestore);
        const addedDate = new Date().toISOString();

        for (const shelfData of previewData) {
            let shelfId: string;
            let shelfRef: any;

            const existingShelf = allShelves.find(s => s.name === shelfData.shelfName);

            if (existingShelf) {
                shelfId = existingShelf.id;
                shelfRef = doc(firestore, 'shelves', shelfId);
            } else {
                shelfRef = doc(collection(firestore, 'shelves'));
                shelfId = shelfRef.id;
                const newShelf: Omit<Shelf, 'id'> = {
                    name: shelfData.shelfName,
                    capacity: shelfData.capacity,
                    type: shelfData.type,
                    createdAt: addedDate,
                    itemCount: 0 // Will be incremented later
                };
                batch.set(shelfRef, newShelf);
            }
            
            let itemsAddedToShelf = 0;
            for (const device of shelfData.devices) {
                const historyEntry: OnuHistoryEntry = {
                    action: 'created',
                    date: addedDate,
                    source: 'file',
                    userId: profile.id,
                    userName: profile.name,
                };
                
                if (device.status === 'new' && (importMode === 'add_only' || importMode === 'overwrite')) {
                    const onuRef = doc(firestore, 'onus', device.id);
                    const newOnu: Omit<OnuData, 'id'> = {
                        shelfId: shelfId,
                        shelfName: shelfData.shelfName,
                        type: shelfData.type,
                        addedDate: addedDate,
                        status: 'active',
                        history: [historyEntry],
                    };
                    batch.set(onuRef, newOnu);
                    itemsAddedToShelf++;
                } else if (device.status === 'existing_moved' && importMode === 'overwrite') {
                    const onuRef = doc(firestore, 'onus', device.id);
                    const existingDevice = allOnus.find(d => d.id === device.id)!;
                    const oldShelf = allShelves.find(s => s.id === existingDevice.shelfId);
                    
                    const moveHistoryEntry: OnuHistoryEntry = {
                        action: 'restored', // or a new 'moved' action
                        date: addedDate,
                        userId: profile.id,
                        userName: profile.name,
                        description: `Movido desde estante ${existingDevice.shelfName} a ${shelfData.shelfName} via importación.`,
                    };

                    batch.update(onuRef, {
                        shelfId: shelfId,
                        shelfName: shelfData.shelfName,
                        history: [...(existingDevice.history || []), moveHistoryEntry]
                    });

                    if (oldShelf) {
                        batch.update(doc(firestore, 'shelves', oldShelf.id), { itemCount: increment(-1) });
                    }
                    itemsAddedToShelf++;
                }
            }

            if (itemsAddedToShelf > 0) {
                const finalItemCount = (existingShelf?.itemCount || 0) + itemsAddedToShelf;
                batch.update(shelfRef, { itemCount: finalItemCount, capacity: Math.max(existingShelf?.capacity || 0, finalItemCount) });
            }
        }

        await batch.commit();

        toast({
            title: '¡Importación completada!',
            description: `Se procesó el archivo con el modo seleccionado.`,
        });

        setFile(null);
        setPreviewData([]);

    } catch (error: any) {
       console.error("Error al importar:", error);
        toast({
          variant: 'destructive',
          title: 'Error durante la importación',
          description: error.message || 'No se pudo guardar en la base de datos.',
        });
    } finally {
        setIsProcessing(false);
        setIsPreviewOpen(false);
    }
  }


  const handleExportByShelf = () => {
    const activeOnus = allOnus.filter(onu => onu.status === 'active');
    const groupedByShelf = activeOnus.reduce((acc, onu) => {
      const shelfName = onu.shelfName;
      if (!acc[shelfName]) {
        acc[shelfName] = [];
      }
      acc[shelfName].push(onu.id);
      return acc;
    }, {} as Record<string, string[]>);

    const shelfNames = Object.keys(groupedByShelf).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    const maxRows = Math.max(0, ...shelfNames.map(name => groupedByShelf[name].length));
    const sheetData: (string | null)[][] = [];
    sheetData.push(shelfNames);

    for (let i = 0; i < maxRows; i++) {
      const row: (string | null)[] = [];
      for (const shelfName of shelfNames) {
        row.push(groupedByShelf[shelfName][i] || null);
      }
      sheetData.push(row);
    }
    
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario por Estante');
    XLSX.writeFile(wb, 'inventario_por_estante.xlsx');
  };
  
  const totalShelvesToCreate = previewData.filter(s => s.isNewShelf).length;
  const totalNewDevices = previewData.reduce((sum, shelf) => sum + shelf.devices.filter(d => d.status === 'new').length, 0);
  const totalMovedDevices = previewData.reduce((sum, shelf) => sum + shelf.devices.filter(d => d.status === 'existing_moved').length, 0);
  const totalDuplicateDevices = previewData.reduce((sum, shelf) => sum + shelf.devices.filter(d => d.status === 'existing_duplicate').length, 0);

  return (
    <section className="w-full max-w-4xl mx-auto flex flex-col gap-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-headline font-semibold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Opciones y Herramientas
        </h2>
        <p className="text-muted-foreground text-sm">
          Configuraciones y herramientas adicionales de la aplicación.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-primary" />
            Importar Inventario desde Excel
          </CardTitle>
          <CardDescription>
            Sube un archivo Excel para crear estantes y cargar dispositivos masivamente. El archivo debe tener los nombres de los estantes en la primera fila y los IDs de los dispositivos debajo de cada estante.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}>
            <input {...getInputProps()} />
            <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
            {isDragActive ? (
              <p className="mt-4 text-primary">Suelta el archivo aquí...</p>
            ) : (
              <p className="mt-4 text-muted-foreground">Arrastra y suelta un archivo .xlsx o haz clic para seleccionarlo.</p>
            )}
          </div>
          {file && (
            <div className="mt-4 flex items-center justify-between rounded-lg border bg-muted/50 p-3">
              <div className="flex items-center gap-2">
                <File className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">{file.name}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setFile(null)} className="h-7 w-7">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handlePreview} disabled={!file || isProcessing}>
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            {isProcessing ? 'Procesando...' : 'Previsualizar Carga'}
          </Button>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-primary" />
            Exportar Inventario
          </CardTitle>
          <CardDescription>
            Descarga un archivo Excel con todos los dispositivos activos, organizados por estante.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExportByShelf}>
            <FileDown className="mr-2 h-4 w-4" />
            Exportar a Excel
          </Button>
        </CardContent>
      </Card>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Vista Previa de la Importación</DialogTitle>
            <DialogDescription>
              Revisa los datos, asigna tipos a los estantes nuevos y elige el modo de importación.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
              <div className='p-3 bg-blue-50 border border-blue-200 rounded-lg'>
                  <p className="text-sm text-blue-700">Estantes a crear</p>
                  <p className="text-2xl font-bold text-blue-800">{totalShelvesToCreate}</p>
              </div>
              <div className='p-3 bg-green-50 border border-green-200 rounded-lg'>
                  <p className="text-sm text-green-700">Nuevos Dispositivos</p>
                  <p className="text-2xl font-bold text-green-800">{totalNewDevices}</p>
              </div>
              <div className='p-3 bg-yellow-50 border border-yellow-200 rounded-lg'>
                  <p className="text-sm text-yellow-700">Dispositivos a Mover</p>
                  <p className="text-2xl font-bold text-yellow-800">{totalMovedDevices}</p>
              </div>
               <div className='p-3 bg-red-50 border border-red-200 rounded-lg'>
                  <p className="text-sm text-red-700">Duplicados (sin cambios)</p>
                  <p className="text-2xl font-bold text-red-800">{totalDuplicateDevices}</p>
              </div>
            </div>

            <ScrollArea className="h-72 border rounded-md p-4">
                <div className="space-y-6">
                    {previewData.map(shelf => (
                        <div key={shelf.shelfName}>
                           <div className="flex justify-between items-center mb-2">
                              <h4 className="font-semibold flex items-center gap-2"><Warehouse className="h-4 w-4"/>{shelf.shelfName} 
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${shelf.isNewShelf ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                                  {shelf.isNewShelf ? 'NUEVO' : 'EXISTENTE'}
                                </span>
                              </h4>
                              <RadioGroup 
                                defaultValue={shelf.type}
                                value={shelf.type}
                                onValueChange={(value: 'onu' | 'stb') => handleDeviceTypeChange(shelf.shelfName, value)} 
                                className="flex items-center gap-4"
                                disabled={!shelf.isNewShelf}
                              >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="onu" id={`r-onu-${shelf.shelfName}`} />
                                    <Label htmlFor={`r-onu-${shelf.shelfName}`} className="text-xs">ONU</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="stb" id={`r-stb-${shelf.shelfName}`} />
                                    <Label htmlFor={`r-stb-${shelf.shelfName}`} className="text-xs">STB</Label>
                                </div>
                              </RadioGroup>
                           </div>
                            <div className="text-xs font-mono pl-6 space-y-1 max-h-48 overflow-y-auto">
                                {shelf.devices.map(device => {
                                    let colorClass = '';
                                    let extraInfo = '';
                                    switch (device.status) {
                                        case 'new':
                                            colorClass = 'text-green-600';
                                            break;
                                        case 'existing_moved':
                                            colorClass = 'text-yellow-600';
                                            extraInfo = `(en ${device.currentShelfName})`;
                                            break;
                                        case 'existing_duplicate':
                                            colorClass = 'text-red-600';
                                            break;
                                    }
                                    return <p key={device.id} className={colorClass}>{device.id} <span className="text-gray-500 font-sans italic">{extraInfo}</span></p>
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
            <div className='p-4 border-l-4 border-yellow-500 bg-yellow-50 mt-4 rounded-r-lg'>
                <div className='flex items-start gap-3'>
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-1"/>
                    <div>
                        <h4 className='font-semibold text-yellow-800'>Modo de Importación</h4>
                         <RadioGroup defaultValue="add_only" value={importMode} onValueChange={(v: 'add_only' | 'overwrite') => setImportMode(v)} className="mt-2 space-y-1">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="add_only" id="mode-add"/>
                                <Label htmlFor="mode-add" className="font-normal">
                                    <strong className='text-yellow-900'>Agregar solo nuevos:</strong> Solo se crearán los dispositivos en verde. Los existentes no se modificarán.
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="overwrite" id="mode-overwrite"/>
                                <Label htmlFor="mode-overwrite" className="font-normal">
                                    <strong className='text-yellow-900'>Sobrescribir y agregar:</strong> Se crearán los dispositivos nuevos (verdes) y se moverán los existentes (amarillos) a los estantes del archivo.
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>
                </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsPreviewOpen(false)} disabled={isProcessing}>Cancelar</Button>
            <Button onClick={handleConfirmImport} disabled={isProcessing}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar e Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

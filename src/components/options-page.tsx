
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Settings, FileDown, UploadCloud, File, X, Loader2, Warehouse, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { OnuData, Shelf } from "@/lib/data";
import { useDropzone } from 'react-dropzone';
import { useFirestore } from '@/firebase';
import { useAuthContext } from '@/firebase/auth/auth-provider';
import { writeBatch, collection, doc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

interface OptionsPageProps {
  allOnus: OnuData[];
}

type PreviewData = {
  shelfName: string;
  deviceIds: string[];
}

export function OptionsPage({ allOnus }: OptionsPageProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { profile } = useAuthContext();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [deviceType, setDeviceType] = useState<'onu' | 'stb'>('onu');
  const [previewData, setPreviewData] = useState<PreviewData[]>([]);

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
    toast({ title: 'Procesando archivo...', description: 'Leyendo el archivo Excel para la vista previa.' });

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result;
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data: (string | number)[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (data.length < 2) {
          throw new Error("El archivo Excel está vacío o no tiene el formato correcto.");
        }

        const headers = data[0] as string[];
        const deviceRows = data.slice(1);
        
        const parsedData: PreviewData[] = [];

        headers.forEach((shelfName, colIndex) => {
          if (!shelfName || typeof shelfName !== 'string' || shelfName.trim() === '') return;
          
          const devicesInShelf = deviceRows.map(row => row[colIndex]).filter(id => id).map(id => String(id).trim());
          if (devicesInShelf.length > 0) {
            parsedData.push({
              shelfName: shelfName.trim(),
              deviceIds: devicesInShelf,
            });
          }
        });

        if (parsedData.length === 0) {
            throw new Error("No se encontraron datos válidos para importar en el archivo.");
        }

        setPreviewData(parsedData);
        setIsPreviewOpen(true);

      } catch (error: any) {
        console.error("Error al previsualizar:", error);
        toast({
          variant: 'destructive',
          title: 'Error al leer el archivo',
          description: error.message || 'No se pudo procesar el archivo Excel.',
        });
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };
  
  const handleConfirmImport = async () => {
    if (previewData.length === 0 || !profile) return;

    setIsProcessing(true);
    toast({ title: 'Iniciando importación...', description: 'Cargando estantes y dispositivos a la base de datos.' });

    try {
      const batch = writeBatch(firestore);
      const addedDate = new Date().toISOString();

      previewData.forEach(({ shelfName, deviceIds }) => {
        const shelfRef = doc(collection(firestore, 'shelves'));
        const newShelf: Omit<Shelf, 'id'> = {
          name: shelfName,
          capacity: deviceIds.length,
          type: deviceType,
          createdAt: addedDate,
          itemCount: deviceIds.length
        };
        batch.set(shelfRef, newShelf);

        deviceIds.forEach(deviceId => {
          const onuRef = doc(firestore, 'onus', deviceId);
          const newOnu: Omit<OnuData, 'id'> = {
            shelfId: shelfRef.id,
            shelfName: shelfName,
            type: deviceType,
            addedDate: addedDate,
            status: 'active',
            history: [{
              action: 'created',
              date: addedDate,
              source: 'file',
              userId: profile.id,
              userName: profile.name,
            }]
          };
          batch.set(onuRef, { id: deviceId, ...newOnu });
        });
      });

      await batch.commit();

      toast({
        title: '¡Importación completada!',
        description: `${previewData.length} estantes y ${previewData.reduce((acc, s) => acc + s.deviceIds.length, 0)} dispositivos han sido cargados.`,
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
  
  const totalShelvesToCreate = previewData.length;
  const totalDevicesToCreate = previewData.reduce((sum, shelf) => sum + shelf.deviceIds.length, 0);

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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vista Previa de la Importación</DialogTitle>
            <DialogDescription>
              Revisa los datos a continuación. Si todo es correcto, confirma para importar a la base de datos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className='p-4 bg-muted/50 rounded-lg'>
                  <p className="text-sm text-muted-foreground">Estantes a crear</p>
                  <p className="text-2xl font-bold">{totalShelvesToCreate}</p>
              </div>
              <div className='p-4 bg-muted/50 rounded-lg'>
                  <p className="text-sm text-muted-foreground">Dispositivos a cargar</p>
                  <p className="text-2xl font-bold">{totalDevicesToCreate}</p>
              </div>
            </div>
             <div>
                <Label>Tipo de dispositivo para esta carga:</Label>
                <RadioGroup defaultValue="onu" value={deviceType} onValueChange={(value: 'onu' | 'stb') => setDeviceType(value)} className="flex items-center gap-4 mt-2">
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="onu" id="r-onu-preview" />
                    <Label htmlFor="r-onu-preview">ONU</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="stb" id="r-stb-preview" />
                    <Label htmlFor="r-stb-preview">STB</Label>
                </div>
                </RadioGroup>
            </div>
            <ScrollArea className="h-64 border rounded-md p-4">
                <div className="space-y-4">
                    {previewData.map(shelf => (
                        <div key={shelf.shelfName}>
                            <h4 className="font-semibold flex items-center gap-2"><Warehouse className="h-4 w-4"/>{shelf.shelfName} <span className="text-sm font-normal text-muted-foreground">({shelf.deviceIds.length} dispositivos)</span></h4>
                            <div className="mt-2 text-xs font-mono text-muted-foreground pl-6 space-y-1">
                                {shelf.deviceIds.map(id => <p key={id}>{id}</p>)}
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
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

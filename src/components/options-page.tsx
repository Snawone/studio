
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Settings, FileDown, UploadCloud, File, X, Loader2 } from "lucide-react";
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

interface OptionsPageProps {
  allOnus: OnuData[];
}

export function OptionsPage({ allOnus }: OptionsPageProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { profile } = useAuthContext();
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [deviceType, setDeviceType] = useState<'onu' | 'stb'>('onu');


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

  const handleImport = async () => {
    if (!file || !profile) return;

    setIsImporting(true);
    toast({ title: 'Iniciando importación...', description: 'Leyendo el archivo Excel.' });

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
        
        const batch = writeBatch(firestore);
        const addedDate = new Date().toISOString();

        headers.forEach((shelfName, colIndex) => {
          if (!shelfName || typeof shelfName !== 'string' || shelfName.trim() === '') return;

          const devicesInShelf = deviceRows.map(row => row[colIndex]).filter(id => id);
          if (devicesInShelf.length === 0) return;

          const shelfRef = doc(collection(firestore, 'shelves'));
          const newShelf: Omit<Shelf, 'id'> = {
            name: shelfName.trim(),
            capacity: devicesInShelf.length,
            type: deviceType,
            createdAt: addedDate,
            itemCount: devicesInShelf.length
          };
          batch.set(shelfRef, newShelf);

          devicesInShelf.forEach(deviceId => {
            const onuId = String(deviceId).trim();
            if (onuId) {
              const onuRef = doc(firestore, 'onus', onuId);
              const newOnu: Omit<OnuData, 'id'> = {
                shelfId: shelfRef.id,
                shelfName: shelfName.trim(),
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
              batch.set(onuRef, { id: onuId, ...newOnu });
            }
          });
        });

        await batch.commit();

        toast({
          title: '¡Importación completada!',
          description: 'Los estantes y dispositivos han sido cargados exitosamente.',
        });

        setFile(null);
      } catch (error: any) {
        console.error("Error al importar:", error);
        toast({
          variant: 'destructive',
          title: 'Error durante la importación',
          description: error.message || 'No se pudo procesar el archivo Excel.',
        });
      } finally {
        setIsImporting(false);
        setIsConfirmModalOpen(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

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
          <Button onClick={() => setIsConfirmModalOpen(true)} disabled={!file || isImporting}>
            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            {isImporting ? 'Importando...' : 'Importar Archivo'}
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

      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Tipo de Dispositivo</DialogTitle>
            <DialogDescription>
              Selecciona el tipo de dispositivo que se aplicará a TODOS los estantes y dispositivos en el archivo de importación. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <RadioGroup defaultValue="onu" onValueChange={(value: 'onu' | 'stb') => setDeviceType(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="onu" id="r-onu" />
                <Label htmlFor="r-onu">ONU (Optical Network Unit)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="stb" id="r-stb" />
                <Label htmlFor="r-stb">STB (Set-Top Box)</Label>
              </div>
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsConfirmModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar e Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

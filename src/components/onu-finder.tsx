
"use client";

import { useState, useMemo, useTransition, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { type OnuData } from "@/lib/data";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger, 
    DialogFooter,
    DialogClose
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileSpreadsheet, Search, Upload, Server, Tag, Link, AlertTriangle, PlusCircle, RotateCcw, Loader2, Calendar as CalendarIcon, Trash2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Icons } from '@/components/icons';
import { Boxes } from 'lucide-react';


type OnuFinderProps = {
    activeView: 'activas' | 'retiradas';
}

export function OnuFinder({ activeView }: OnuFinderProps) {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');

  const [data, setData] = useState<OnuData[]>([]);
  const [removedOnus, setRemovedOnus] = useState<OnuData[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');

  const [newOnuId, setNewOnuId] = useState('');
  const [newOnuShelf, setNewOnuShelf] = useState('');
  const [isAddOnuOpen, setIsAddOnuOpen] = useState(false);

  const [onuToManage, setOnuToManage] = useState<OnuData | null>(null);
  const [isConfirmRetireOpen, setIsConfirmRetireOpen] = useState(false);
  const [isConfirmRestoreOpen, setIsConfirmRestoreOpen] = useState(false);

  useEffect(() => {
    try {
      const savedFileName = localStorage.getItem('onuFileName');
      if (savedFileName) {
        setIsLoading(true);
        const savedFileContent = localStorage.getItem('onuFileContent');
        if (savedFileContent) {
          const workbook = XLSX.read(savedFileContent, { type: 'binary' });
          setWorkbook(workbook);
          const sheets = workbook.SheetNames;
          setSheetNames(sheets);
          setFileName(savedFileName);
          
          const savedSheet = localStorage.getItem('onuSelectedSheet');
          const sheetToLoad = savedSheet && sheets.includes(savedSheet) ? savedSheet : sheets[0];
          setSelectedSheet(sheetToLoad);
          
          const savedData = localStorage.getItem(`onuData_${sheetToLoad}`);
          setData(savedData ? JSON.parse(savedData) : []);

          const savedRemovedOnus = localStorage.getItem(`onuRemovedData_${sheetToLoad}`);
          setRemovedOnus(savedRemovedOnus ? JSON.parse(savedRemovedOnus) : []);

          setIsDataLoaded(true);
        }
        setIsLoading(false);
      }
    } catch (e) {
      console.error("Failed to load data from localStorage", e);
      resetState();
    } finally {
      setIsHydrating(false);
    }
  }, []);

  useEffect(() => {
    if (workbook && selectedSheet && !isHydrating) {
      const savedData = localStorage.getItem(`onuData_${selectedSheet}`);
      const savedRemovedOnus = localStorage.getItem(`onuRemovedData_${selectedSheet}`);

      if (savedData) {
        setData(JSON.parse(savedData));
      } else {
        parseSheetData(workbook, selectedSheet);
      }

      if (savedRemovedOnus) {
        setRemovedOnus(JSON.parse(savedRemovedOnus));
      } else {
        setRemovedOnus([]);
      }
      localStorage.setItem('onuSelectedSheet', selectedSheet);
    }
  }, [workbook, selectedSheet, isHydrating]);


  useEffect(() => {
    if (!isHydrating && isDataLoaded) {
      try {
        localStorage.setItem(`onuData_${selectedSheet}`, JSON.stringify(data));
        localStorage.setItem(`onuRemovedData_${selectedSheet}`, JSON.stringify(removedOnus));
      } catch (e) {
        console.error("Failed to save data to localStorage", e);
      }
    }
  }, [data, removedOnus, selectedSheet, isHydrating, isDataLoaded]);

  const parseSheetData = (wb: XLSX.WorkBook, sheetName: string) => {
    try {
        const worksheet = wb.Sheets[sheetName];
        const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

        if (sheetData.length < 2) {
            setData([]);
            return;
        }
        
        const headers = sheetData[0].map(h => String(h || '').trim());
        const newOnuData: OnuData[] = [];
        const fileProcessDate = new Date().toISOString();

        for (let colIndex = 0; colIndex < headers.length; colIndex++) {
            const shelf = headers[colIndex];
            if (shelf) {
                for (let rowIndex = 1; rowIndex < sheetData.length; rowIndex++) {
                    const row = sheetData[rowIndex];
                    if(row) {
                        const onuId = row[colIndex];
                        if (onuId !== null && onuId !== undefined && String(onuId).trim() !== '') {
                            newOnuData.push({
                                'Shelf': shelf,
                                'ONU ID': String(onuId),
                                addedDate: fileProcessDate,
                            });
                        }
                    }
                }
            }
        }
        
        setData(newOnuData);
    } catch (err: any) {
        setError(err.message || `Error al procesar la hoja "${sheetName}".`);
        setData([]);
    }
  };


  const handleFile = (file: File, fileContent: string | ArrayBuffer) => {
    try {
        const wb = XLSX.read(fileContent, { type: 'binary' });
        setWorkbook(wb);
        const sheets = wb.SheetNames;
        setSheetNames(sheets);
        setFileName(file.name);
        
        const firstSheet = sheets[0];
        setSelectedSheet(firstSheet);
        parseSheetData(wb, firstSheet);
        setRemovedOnus([]);
        
        setIsDataLoaded(true);
        setError(null);
        
        if (typeof fileContent === 'string') {
            localStorage.setItem('onuFileContent', fileContent);
        } else {
            const binaryString = new Uint8Array(fileContent).reduce((data, byte) => data + String.fromCharCode(byte), '');
            localStorage.setItem('onuFileContent', binaryString);
        }
        localStorage.setItem('onuFileName', file.name);
        localStorage.setItem('onuSelectedSheet', firstSheet);
        sheetNames.forEach(sheet => {
            localStorage.removeItem(`onuData_${sheet}`);
            localStorage.removeItem(`onuRemovedData_${sheet}`);
        });

    } catch (err: any) {
        setError(err.message || 'Error al procesar el archivo. Asegúrate que sea un archivo Excel válido con el formato correcto.');
    } finally {
        setIsLoading(false);
    }
  };

  const handleFileRead = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const fileContent = e.target?.result;
        if (!fileContent) {
            setError("No se pudo leer el archivo.");
            setIsLoading(false);
            return;
        }
        handleFile(file, fileContent);
    };
    reader.onerror = () => {
        setError('Error al leer el archivo.');
        setIsLoading(false);
    };
    reader.readAsBinaryString(file);
  };


  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsLoading(true);
      setError(null);
      handleFileRead(file);
    }
  };
  
  const handleUrlFetch = async () => {
    if (!url) {
      setError('Por favor, ingresa una URL válida.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Error al obtener el archivo: ${response.statusText}`);
      }
      const blob = await response.blob();
      const file = new File([blob], url.substring(url.lastIndexOf('/') + 1) || 'archivo_remoto.xlsx');
      handleFileRead(file);

    } catch (err: any) {
      setError(err.message || 'No se pudo obtener o procesar el archivo desde la URL.');
      setIsLoading(false);
    }
  };

  const handleConfirmRetire = () => {
    if (onuToManage) {
        const retiredOnu = { ...onuToManage, removedDate: new Date().toISOString() };
        setData(prevData => prevData.filter(onu => onu['ONU ID'] !== retiredOnu['ONU ID']));
        setRemovedOnus(prevRemoved => [retiredOnu, ...prevRemoved]);
    }
    setIsConfirmRetireOpen(false);
    setOnuToManage(null);
  };
  
  const handleConfirmRestore = () => {
    if (onuToManage) {
      const restoredOnu = { ...onuToManage };
      delete restoredOnu.removedDate;
      setRemovedOnus(prevRemoved => prevRemoved.filter(onu => onu['ONU ID'] !== restoredOnu['ONU ID']));
      setData(prevData => [restoredOnu, ...prevData]);
    }
    setIsConfirmRestoreOpen(false);
    setOnuToManage(null);
  };

  const handleAddOnu = () => {
      if(!newOnuId || !newOnuShelf) {
          alert("Por favor completa ambos campos.");
          return;
      }
      const newOnu: OnuData = {
          'ONU ID': newOnuId,
          'Shelf': newOnuShelf,
          addedDate: new Date().toISOString(),
      };
      setData(prevData => [newOnu, ...prevData]);
      setNewOnuId('');
      setNewOnuShelf('');
      setIsAddOnuOpen(false);
  };

  const filteredResults = useMemo(() => {
    const sourceData = activeView === 'activas' ? data : removedOnus;
    if (!searchTerm) return sourceData;
    return sourceData.filter((row) => 
        row['ONU ID']?.toString().toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, data, removedOnus, activeView]);
  
  const shelves = useMemo(() => {
    const shelfMap: Record<string, OnuData[]> = {};
    const sourceData = activeView === 'activas' ? data : [];
    
    if (activeView === 'activas') {
        sourceData.forEach(onu => {
            const shelf = onu.Shelf || 'Sin Estante';
            if (!shelfMap[shelf]) {
                shelfMap[shelf] = [];
            }
            shelfMap[shelf].push(onu);
        });
    }
    return Object.entries(shelfMap).sort(([shelfA], [shelfB]) => shelfA.localeCompare(shelfB, undefined, { numeric: true, sensitivity: 'base' }));
  }, [data, activeView]);

  const allShelves = useMemo(() => {
    const uniqueShelves = new Set(data.map(onu => onu.Shelf));
    return Array.from(uniqueShelves).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [data]);


  const resetState = () => {
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet('');
    setData([]);
    setRemovedOnus([]);
    setFileName(null);
    setIsDataLoaded(false);
    setError(null);
    setSearchTerm('');
    setUrl('');
    if(fileInputRef.current) {
        fileInputRef.current.value = '';
    }
    localStorage.removeItem('onuFileContent');
    localStorage.removeItem('onuFileName');
    localStorage.removeItem('onuSelectedSheet');
    sheetNames.forEach(sheet => {
        localStorage.removeItem(`onuData_${sheet}`);
        localStorage.removeItem(`onuRemovedData_${sheet}`);
    });
  };
  
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es });
    } catch (e) {
      return 'Fecha inválida';
    }
  };

  const renderOnuCard = (row: OnuData, index: number, isRetired = false) => {
    const isExactMatch = searchTerm.length > 0 && row['ONU ID'].toLowerCase() === searchTerm.toLowerCase();
    const onuId = row['ONU ID'];
    const idPrefix = onuId.slice(0, -6);
    const idSuffix = onuId.slice(-6);
  
    return (
      <Card key={`${row.Shelf}-${row['ONU ID']}-${index}`} className="group flex flex-col justify-between">
        <div>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-start text-base text-primary break-all">
              <Tag className="mr-2 h-4 w-4 flex-shrink-0 mt-1"/>
              <div>
                {isExactMatch ? (
                  <>
                    <span>{idPrefix}</span>
                    <span className="font-bold text-lg">{idSuffix}</span>
                  </>
                ) : (
                  onuId
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="flex items-center font-medium">
              <Server className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground mr-2">Estante:</span> 
              <span className={`font-bold text-foreground ${isExactMatch ? 'text-lg' : ''}`}>{row.Shelf}</span>
            </p>
            <p className="flex items-center font-medium">
              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground mr-2">Agregada:</span> 
              <span className="text-foreground">{formatDate(row.addedDate)}</span>
            </p>
            {isRetired && row.removedDate && (
               <p className="flex items-center font-medium text-destructive/80">
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span className="mr-2">Retirada:</span> 
                  <span className="">{formatDate(row.removedDate)}</span>
              </p>
            )}
          </CardContent>
        </div>
        <CardFooter className="p-4">
          {isRetired ? (
            <Button 
              variant="outline"
              size="sm"
              className="w-full text-green-600 hover:text-green-700 hover:bg-green-50 border-green-600/50"
              onClick={() => {
                setOnuToManage(row);
                setIsConfirmRestoreOpen(true);
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Devolver
            </Button>
          ) : (
            <Button 
              variant="outline"
              size="sm"
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/50"
              onClick={() => {
                setOnuToManage(row);
                setIsConfirmRetireOpen(true);
              }}
            >
              Retirar
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  }

  const renderSearchResults = () => (
    <div className="space-y-4">
        {filteredResults.length > 0 ? (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
               {filteredResults.map((onu, index) => renderOnuCard(onu, index, activeView === 'retiradas'))}
           </div>
        ) : (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">
                  No se encontraron resultados para <strong className="text-foreground">"{searchTerm}"</strong>.
                </p>
            </div>
        )}
    </div>
  );

  const renderShelfAccordion = () => (
    <div className="space-y-4">
        {shelves.length > 0 ? (
            <Accordion type="single" collapsible className="w-full" defaultValue={shelves.length > 0 ? shelves[0][0] : undefined}>
                {shelves.map(([shelf, onus]) => (
                    <AccordionItem value={shelf} key={shelf}>
                        <AccordionTrigger>
                            <div className="flex items-center gap-3">
                                <Server className="h-5 w-5 text-primary" />
                                <span className="font-medium">{shelf}</span>
                                <Badge variant="secondary">{onus.length} ONUs</Badge>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                                {onus.map((onu, index) => renderOnuCard(onu, index, false))}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        ) : (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">
                  "No hay ONUs activas para mostrar."
                </p>
            </div>
        )}
    </div>
  );

  const renderRemovedList = () => (
      <div className="space-y-4">
        {filteredResults.length > 0 ? (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
               {filteredResults.map((onu, index) => renderOnuCard(onu, index, true))}
           </div>
        ) : (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">
                  {searchTerm 
                    ? <>No se encontraron resultados para <strong className="text-foreground">"{searchTerm}"</strong>.</>
                    : "No hay ONUs retiradas."
                  }
                </p>
            </div>
        )}
      </div>
  );
  
  if (isHydrating) {
    return (
        <section className="w-full max-w-7xl mx-auto flex flex-col gap-8 justify-center items-center min-h-[calc(100vh-200px)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando datos...</p>
        </section>
    );
  }


  return (
    <section className="w-full max-w-7xl mx-auto flex flex-col gap-8">
      {!isDataLoaded ? (
        <Card className="text-center max-w-xl mx-auto">
          <CardHeader>
            <div className="mx-auto bg-secondary p-3 rounded-full w-fit">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="font-headline mt-4">Importar Hoja de Cálculo</CardTitle>
            <CardDescription>
              Sube tu archivo de Excel o CSV, o pega un enlace para empezar a buscar tus ONUs. Los datos se guardarán en tu navegador.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {isLoading ? (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Procesando archivo...</p>
              </div>
            ) : (
              <>
                {error && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                <div className="flex flex-col items-center gap-4">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".xlsx, .xls, .csv"
                    />
                    <Button onClick={() => fileInputRef.current?.click()}>
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        Subir Archivo
                    </Button>
                </div>

                <div className="flex items-center gap-4">
                    <hr className="flex-grow border-t" />
                    <span className="text-xs text-muted-foreground">O</span>
                    <hr className="flex-grow border-t" />
                </div>

                <div className="flex flex-col items-center gap-3">
                    <div className="w-full max-w-sm space-y-2 text-left">
                       <Label htmlFor="url-input">Importar desde URL</Label>
                       <div className="flex gap-2">
                         <Input 
                            id="url-input"
                            type="url"
                            placeholder="https://example.com/inventario.xlsx"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                         />
                         <Button onClick={handleUrlFetch} variant="secondary" disabled={isLoading}>
                           <Link className="h-4 w-4" />
                         </Button>
                       </div>
                    </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
         <div className="space-y-4">
            <div className="flex justify-between items-start gap-4 flex-wrap">
                <div>
                    <div className="flex items-center gap-2">
                         <div className="md:hidden">
                            <SidebarTrigger />
                         </div>
                        <h2 className="text-2xl font-headline font-semibold">
                            {activeView === 'activas' ? `Inventario de ONUs Activas (${data.length})` : `ONUs Retiradas (${removedOnus.length})`}
                        </h2>
                    </div>
                    <p className="text-muted-foreground text-sm mt-1">
                        {activeView === 'activas' ? 'Visualiza y gestiona las ONUs disponibles en los estantes.' : 'Consulta el historial de ONUs que han sido retiradas.'}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Dialog open={isAddOnuOpen} onOpenChange={setIsAddOnuOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Agregar ONU
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Agregar Nueva ONU/STB</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="new-onu-id" className="text-right">ID de ONU</Label>
                                    <Input id="new-onu-id" value={newOnuId} onChange={(e) => setNewOnuId(e.target.value)} className="col-span-3" placeholder="Ej: 2430011054007532" />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="new-onu-shelf" className="text-right">Estante</Label>
                                    <Select value={newOnuShelf} onValueChange={setNewOnuShelf}>
                                      <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder="Selecciona un estante" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {allShelves.map(shelf => (
                                          <SelectItem key={shelf} value={shelf}>{shelf}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild>
                                  <Button variant="outline">Cancelar</Button>
                                </DialogClose>
                                <Button onClick={handleAddOnu}>Guardar ONU</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <Button variant="destructive" size="sm" onClick={resetState}>
                        Cargar otro archivo
                    </Button>
                </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 text-sm">
                <p className="text-muted-foreground">Archivo cargado: <span className="font-medium text-foreground">{fileName}</span></p>
                {sheetNames.length > 1 && (
                    <div className="flex items-center gap-2 mt-2 sm:mt-0">
                        <Label htmlFor="sheet-selector" className="text-muted-foreground">Hoja:</Label>
                        <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                            <SelectTrigger id="sheet-selector" className="h-8 w-auto max-w-[200px]">
                                <SelectValue placeholder="Selecciona una hoja" />
                            </SelectTrigger>
                            <SelectContent>
                                {sheetNames.map(name => (
                                    <SelectItem key={name} value={name}>{name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>
         </div>

         <Card>
            <CardHeader>
                <CardTitle>Búsqueda Rápida</CardTitle>
                <CardDescription>Busca por ID en la vista actual.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-xl">
                <Label htmlFor="search-term">ID de la ONU</Label>
                <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    id="search-term"
                    type="text"
                    placeholder={`Buscar entre ${activeView === 'activas' ? data.length : removedOnus.length} ONUs...`}
                    value={searchTerm}
                    onChange={(e) => {
                      startTransition(() => {
                          setSearchTerm(e.target.value);
                      });
                    }}
                    className="pl-10 w-full"
                />
                </div>
              </div>
            </CardContent>
         </Card>
          
        <div className="mt-6">
            {isPending || isLoading ? (
                <div className="space-y-4 pt-4">
                    {[...Array(3)].map((_, i) => ( <Skeleton key={i} className="h-24 w-full" /> ))}
                </div>
            ) : (
              <>
                {searchTerm ? (
                  renderSearchResults()
                ) : (
                  activeView === 'activas' ? renderShelfAccordion() : renderRemovedList()
                )}
              </>
            )}
        </div>
        </>
      )}

      {/* Confirmation Dialogs */}
      <AlertDialog open={isConfirmRetireOpen} onOpenChange={setIsConfirmRetireOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción marcará la ONU <strong className="break-all">{onuToManage?.['ONU ID']}</strong> como retirada. Podrás devolverla al inventario más tarde desde la pestaña "Retiradas".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOnuToManage(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRetire} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sí, retirar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={isConfirmRestoreOpen} onOpenChange={setIsConfirmRestoreOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar devolución?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción devolverá la ONU <strong className="break-all">{onuToManage?.['ONU ID']}</strong> a la lista de activas en el estante <strong>{onuToManage?.Shelf}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOnuToManage(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRestore}>
              Sí, devolver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

    
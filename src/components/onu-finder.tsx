
"use client";

import { useState, useMemo, useTransition, useRef } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileSpreadsheet, Search, Upload, Server, Tag, Link, AlertTriangle, Trash2, PlusCircle, XCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";


export function OnuFinder() {
  const [data, setData] = useState<OnuData[]>([]);
  const [removedOnus, setRemovedOnus] = useState<OnuData[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');

  const [newOnuId, setNewOnuId] = useState('');
  const [newOnuShelf, setNewOnuShelf] = useState('');
  const [isAddOnuOpen, setIsAddOnuOpen] = useState(false);


  const handleFileParse = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const fileContent = e.target?.result;
        if (!fileContent) throw new Error("No se pudo leer el archivo.");
        const workbook = XLSX.read(fileContent, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

        if (sheetData.length < 2) {
          throw new Error("La hoja de cálculo está vacía o no tiene el formato correcto.");
        }
        
        const headers = sheetData[0].map(h => String(h || '').trim());
        const newOnuData: OnuData[] = [];

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
                            });
                        }
                    }
                }
            }
        }

        if (newOnuData.length === 0) {
            throw new Error("No se encontraron datos de ONU en el archivo.");
        }
        
        setData(newOnuData);
        setFileName(file.name);
        setIsDataLoaded(true);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Error al procesar el archivo. Asegúrate que sea un archivo Excel válido con el formato correcto.');
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
        setError('Error al leer el archivo.');
        setIsLoading(false);
    }
    reader.readAsArrayBuffer(file);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsLoading(true);
      setError(null);
      handleFileParse(file);
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
      const file = new File([blob], url.substring(url.lastIndexOf('/') + 1) || 'archivo_remoto');
      handleFileParse(file);

    } catch (err: any) {
      setError(err.message || 'No se pudo obtener o procesar el archivo desde la URL.');
      setIsLoading(false);
    }
  };

  const handleRemoveOnu = (onuToRemove: OnuData) => {
    setData(prevData => prevData.filter(onu => onu['ONU ID'] !== onuToRemove['ONU ID']));
    setRemovedOnus(prevRemoved => [onuToRemove, ...prevRemoved]);
  };
  
  const handleAddOnu = () => {
      if(!newOnuId || !newOnuShelf) {
          alert("Por favor completa ambos campos.");
          return;
      }
      const newOnu: OnuData = {
          'ONU ID': newOnuId,
          'Shelf': newOnuShelf,
      };
      setData(prevData => [newOnu, ...prevData]);
      setNewOnuId('');
      setNewOnuShelf('');
      setIsAddOnuOpen(false);
  };

  const filteredResults = useMemo(() => {
    if (!searchTerm) return data;
    return data.filter((row) => 
        row['ONU ID']?.toString().toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, data]);
  
  const filteredRemovedResults = useMemo(() => {
    if (!searchTerm) return removedOnus;
    return removedOnus.filter((row) => 
        row['ONU ID']?.toString().toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, removedOnus]);

  const shelves = useMemo(() => {
    const shelfMap: Record<string, OnuData[]> = {};
    filteredResults.forEach(onu => {
        const shelf = onu.Shelf || 'Sin Estante';
        if (!shelfMap[shelf]) {
            shelfMap[shelf] = [];
        }
        shelfMap[shelf].push(onu);
    });
    return Object.entries(shelfMap).sort(([shelfA], [shelfB]) => shelfA.localeCompare(shelfB));
  }, [filteredResults]);


  const resetState = () => {
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
  };

  const renderOnuCard = (row: OnuData, index: number) => (
    <Card key={`${row.Shelf}-${row['ONU ID']}-${index}`} className="relative group">
      <CardHeader>
        <CardTitle className="flex items-center text-base text-primary break-all">
          <Tag className="mr-2 h-4 w-4 flex-shrink-0"/>
          {row['ONU ID']}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="flex items-center text-sm font-medium">
          <Server className="mr-2 h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground mr-2">Estante:</span> 
          <span className="font-bold text-foreground">{row.Shelf}</span>
        </p>
      </CardContent>
      <Button 
        variant="ghost" 
        size="icon" 
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
        onClick={() => handleRemoveOnu(row)}
        title="Marcar como retirada"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </Card>
  );

 const renderRemovedOnuCard = (row: OnuData, index: number) => (
    <Card key={`removed-${row.Shelf}-${row['ONU ID']}-${index}`} className="bg-muted/50">
      <CardHeader>
        <CardTitle className="flex items-center text-base text-muted-foreground break-all">
          <XCircle className="mr-2 h-4 w-4 flex-shrink-0"/>
          {row['ONU ID']}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="flex items-center text-sm font-medium">
          <Server className="mr-2 h-4 w-4 text-muted-foreground/70" />
          <span className="text-muted-foreground/70 mr-2">Estante:</span> 
          <span className="font-bold text-muted-foreground">{row.Shelf}</span>
        </p>
      </CardContent>
    </Card>
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
                                {onus.map(renderOnuCard)}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        ) : (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">
                  {searchTerm 
                    ? <>No se encontraron resultados para <strong className="text-foreground">"{searchTerm}"</strong>.</>
                    : "No hay ONUs activas para mostrar."
                  }
                </p>
            </div>
        )}
    </div>
  );

  const renderRemovedList = () => (
    <div className="space-y-4">
        {filteredRemovedResults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredRemovedResults.map(renderRemovedOnuCard)}
            </div>
        ) : (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">
                  {searchTerm 
                    ? <>No se encontraron ONUs retiradas para <strong className="text-foreground">"{searchTerm}"</strong>.</>
                    : "No hay ONUs marcadas como retiradas."
                  }
                </p>
            </div>
        )}
    </div>
  )


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
              Sube tu archivo de Excel o CSV, o pega un enlace para empezar a buscar tus ONUs.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {isLoading ? (
              <div className="flex flex-col items-center gap-4">
                <Skeleton className="h-10 w-48" />
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
                         <Button onClick={handleUrlFetch} variant="secondary">
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
            <div className="flex justify-between items-center gap-4 flex-wrap">
                <h2 className="text-2xl font-headline font-semibold">Inventario de ONUs</h2>
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
                                    <Input id="new-onu-shelf" value={newOnuShelf} onChange={(e) => setNewOnuShelf(e.target.value)} className="col-span-3" placeholder="Ej: Box1" />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleAddOnu}>Guardar ONU</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <Button variant="outline" size="sm" onClick={resetState}>
                        Cargar otro archivo
                    </Button>
                </div>
            </div>
            <p className="text-muted-foreground">Archivo cargado: <span className="font-medium text-foreground">{fileName}</span></p>
         </div>

         <Card>
            <CardHeader>
                <CardTitle>Búsqueda Rápida de ONU</CardTitle>
                <CardDescription>Encuentra una ONU específica buscando por su ID en todas las pestañas.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-xl">
                <Label htmlFor="search-term">ID de la ONU</Label>
                <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    id="search-term"
                    type="text"
                    placeholder={`Buscar entre ${data.length + removedOnus.length} ONUs...`}
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
          
          <Tabs defaultValue="active">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="active">
                    Activas <Badge variant={searchTerm ? "secondary" : "default"} className="ml-2">{filteredResults.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="removed">
                    Retiradas <Badge variant="secondary" className="ml-2">{filteredRemovedResults.length}</Badge>
                </TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="mt-6">
                {isPending ? (
                  <div className="space-y-4">
                      {[...Array(3)].map((_, i) => ( <Skeleton key={i} className="h-12 w-full" /> ))}
                  </div>
                ) : (
                  renderShelfAccordion()
                )}
            </TabsContent>
            <TabsContent value="removed" className="mt-6">
                {isPending ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {[...Array(8)].map((_, i) => (
                          <Card key={i}><CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader><CardContent><Skeleton className="h-4 w-1/2" /></CardContent></Card>
                        ))}
                    </div>
                ) : (
                  renderRemovedList()
                )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </section>
  );
}

    
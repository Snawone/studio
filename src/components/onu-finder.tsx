
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
import { FileSpreadsheet, Search, Upload, Server, Tag, Link, AlertTriangle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";


export function OnuFinder() {
  const [data, setData] = useState<OnuData[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');


  const handleFileParse = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const fileContent = e.target?.result;
        if (!fileContent) throw new Error("No se pudo leer el archivo.");
        const workbook = XLSX.read(fileContent, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Use header: 1 to get array of arrays
        const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (sheetData.length < 2) {
          throw new Error("La hoja de cálculo está vacía o no tiene el formato correcto.");
        }

        const headers = sheetData[0].filter(h => h); // Shelf names
        const newOnuData: OnuData[] = [];

        for (let i = 1; i < sheetData.length; i++) {
          const row = sheetData[i];
          for (let j = 0; j < headers.length; j++) {
            const shelf = headers[j];
            const onuId = row[j];
            if (onuId) {
              newOnuData.push({
                'Shelf': String(shelf),
                'ONU ID': String(onuId),
              });
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

  const filteredResults = useMemo(() => {
    if (!searchTerm) return [];
    return data.filter((row) => 
        row['ONU ID']?.toString().toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, data]);

  const shelves = useMemo(() => {
    const shelfMap: Record<string, OnuData[]> = {};
    const dataToProcess = searchTerm ? filteredResults : data;

    dataToProcess.forEach(onu => {
        const shelf = onu.Shelf || 'Sin Estante';
        if (!shelfMap[shelf]) {
            shelfMap[shelf] = [];
        }
        shelfMap[shelf].push(onu);
    });
    return Object.entries(shelfMap).sort(([shelfA], [shelfB]) => shelfA.localeCompare(shelfB));
  }, [data, searchTerm, filteredResults]);


  const resetState = () => {
    setData([]);
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
    <Card key={`${row.Shelf}-${row['ONU ID']}-${index}`}>
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
    </Card>
  );

  const renderShelfAccordion = () => (
    <div className="space-y-4">
        <h3 className="text-xl font-headline font-semibold">
          {searchTerm ? `Resultados en Estantes (${filteredResults.length})` : 'Equipos por Estante'}
        </h3>
        {isLoading ? (
             <div className="space-y-4">
                {[...Array(3)].map((_, i) => ( <Skeleton key={i} className="h-12 w-full" /> ))}
            </div>
        ) : shelves.length > 0 ? (
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
                    : "No hay datos de estantes para mostrar."
                  }
                </p>
            </div>
        )}
    </div>
  );


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
            <div className="flex justify-between items-center gap-4">
                <h2 className="text-2xl font-headline font-semibold">Inventario de ONUs</h2>
                <Button variant="outline" size="sm" onClick={resetState}>
                    Cargar otro archivo
                </Button>
            </div>
            <p className="text-muted-foreground">Archivo cargado: <span className="font-medium text-foreground">{fileName}</span></p>
         </div>

         <Card>
            <CardHeader>
                <CardTitle>Búsqueda Rápida de ONU</CardTitle>
                <CardDescription>Encuentra una ONU específica buscando por su ID.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-xl">
                <Label htmlFor="search-term">ID de la ONU</Label>
                <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    id="search-term"
                    type="text"
                    placeholder={`Buscar entre ${data.length} ONUs...`}
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
          
          {isPending ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {[...Array(8)].map((_, i) => (
                      <Card key={i}>
                          <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
                          <CardContent><Skeleton className="h-4 w-1/2" /></CardContent>
                      </Card>
                  ))}
              </div>
          ) : renderShelfAccordion()
          }
        </>
      )}
    </section>
  );
}

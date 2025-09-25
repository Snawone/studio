
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FileSpreadsheet, Search, Upload, Package, Rows, Tag, Server, Link, AlertTriangle } from "lucide-react";

export function OnuFinder() {
  const [data, setData] = useState<OnuData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchColumn, setSearchColumn] = useState<string>("");
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
        const jsonData = XLSX.utils.sheet_to_json<OnuData>(worksheet);

        if (jsonData.length === 0) {
          throw new Error("La hoja de cálculo está vacía o no tiene el formato correcto.");
        }
        
        setData(jsonData);
        const firstRow = jsonData[0];

        // Validar que la primera fila es un objeto y no está vacía
        if (typeof firstRow !== 'object' || firstRow === null || Object.keys(firstRow).length === 0) {
            throw new Error("El formato de los datos no es válido. La primera fila está vacía o corrupta.");
        }

        const newHeaders = Object.keys(firstRow);
        setHeaders(newHeaders);
        setSearchColumn(newHeaders[0]);
        setFileName(file.name);
        setIsDataLoaded(true);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Error al procesar el archivo. Asegúrate que sea un archivo Excel o CSV válido.');
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
    if (!searchTerm) return data;
    if (!searchColumn) return data;

    return data.filter((row) => {
        const value = row[searchColumn as keyof OnuData];
        return value?.toString().toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [searchTerm, searchColumn, data]);

  const getStatusVariant = (status: OnuData['Status']) => {
    if (!status) return 'outline';
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === 'active') return 'default';
    if (lowerStatus === 'inactive') return 'secondary';
    if (lowerStatus === 'maintenance') return 'destructive';
    return 'outline';
  };
  
  const getIconForHeader = (header: string) => {
    const lowerHeader = header.toLowerCase();
    if(lowerHeader.includes('id')) return <Tag className="mr-2 h-4 w-4 text-muted-foreground" />;
    if(lowerHeader.includes('model')) return <Package className="mr-2 h-4 w-4 text-muted-foreground" />;
    if(lowerHeader.includes('shelf')) return <Server className="mr-2 h-4 w-4 text-muted-foreground" />;
    if(lowerHeader.includes('rack')) return <Rows className="mr-2 h-4 w-4 text-muted-foreground" />;
    return null;
  }

  const resetState = () => {
    setData([]);
    setHeaders([]);
    setFileName(null);
    setIsDataLoaded(false);
    setError(null);
    setSearchTerm('');
    setSearchColumn('');
    setUrl('');
    if(fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };


  return (
    <section className="w-full max-w-4xl mx-auto flex flex-col gap-8">
      {!isDataLoaded ? (
        <Card className="text-center">
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
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-headline font-semibold">Búsqueda de Equipos</h2>
                <Button variant="outline" size="sm" onClick={resetState}>
                    Cargar otro archivo
                </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-card">
              <div className="space-y-2">
                <Label htmlFor="search-column">Buscar en Columna</Label>
                <Select value={searchColumn} onValueChange={setSearchColumn}>
                  <SelectTrigger id="search-column" className="w-full">
                    <SelectValue placeholder="Seleccionar columna" />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map((header) => (
                      <SelectItem key={header} value={header}>
                        <div className="flex items-center">
                           {getIconForHeader(header)}
                           {header}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="search-term">Término de Búsqueda</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search-term"
                    type="text"
                    placeholder={`Buscar en "${searchColumn}"...`}
                    value={searchTerm}
                    onChange={(e) => {
                      startTransition(() => {
                        setSearchTerm(e.target.value);
                      });
                    }}
                    className="pl-10 w-full"
                    disabled={!searchColumn}
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
             <h3 className="text-xl font-headline font-semibold">Resultados para "{fileName}" ({filteredResults.length})</h3>
             {isPending ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                        <Card key={i}>
                            <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
                            <CardContent className="space-y-2">
                                <Skeleton className="h-4 w-1/2" />
                                <Skeleton className="h-4 w-1/3" />
                            </CardContent>
                            <CardFooter><Skeleton className="h-6 w-20" /></CardFooter>
                        </Card>
                    ))}
                 </div>
             ) : filteredResults.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in-50">
                  {filteredResults.map((row, index) => (
                    <Card key={index}>
                      <CardHeader>
                        <CardTitle className="flex items-center text-primary">
                          <Tag className="mr-2 h-5 w-5"/>
                          {row['ONU ID']}
                        </CardTitle>
                        <CardDescription className="flex items-center">
                          <Package className="mr-2 h-4 w-4"/>
                          {row.Model}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm font-medium">
                        <p className="flex items-center">
                          <Server className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground mr-2">Estante:</span> 
                          <span className="font-bold text-foreground">{row.Shelf}</span>
                        </p>
                        <p className="flex items-center">
                          <Rows className="mr-2 h-4 w-4 text-muted-foreground" />
                           <span className="text-muted-foreground mr-2">Rack:</span>
                           <span className="font-bold text-foreground">{row.Rack}</span>
                        </p>
                      </CardContent>
                      <CardFooter>
                         <Badge variant={getStatusVariant(row.Status)}>{row.Status || 'N/A'}</Badge>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground">No se encontraron resultados para <strong className="text-foreground">"{searchTerm}"</strong>.</p>
                </div>
              )}
          </div>
        </>
      )}
    </section>
  );
}

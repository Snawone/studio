"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { DUMMY_DATA, type OnuData } from "@/lib/data";
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
import { FileSpreadsheet, Search, Upload, Package, Rows, Tag, Server } from "lucide-react";

export function OnuFinder() {
  const [data, setData] = useState<OnuData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [searchColumn, setSearchColumn] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleUpload = () => {
    setIsUploading(true);
    setTimeout(() => {
      setData(DUMMY_DATA);
      setHeaders(Object.keys(DUMMY_DATA[0]));
      setSearchColumn(Object.keys(DUMMY_DATA[0])[0]);
      setFileName("inventario_onus.xlsx");
      setIsDataLoaded(true);
      setIsUploading(false);
    }, 1500);
  };
  
  const filteredResults = useMemo(() => {
    if (!searchTerm) return data;
    if (!searchColumn) return data;

    return data.filter((row) => {
        const value = row[searchColumn as keyof OnuData];
        return value.toString().toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [searchTerm, searchColumn, data]);

  const getStatusVariant = (status: OnuData['Status']) => {
    switch (status) {
      case 'Active':
        return 'default';
      case 'Inactive':
        return 'secondary';
      case 'Maintenance':
        return 'destructive';
      default:
        return 'outline';
    }
  };
  
  const getIconForHeader = (header: string) => {
    const lowerHeader = header.toLowerCase();
    if(lowerHeader.includes('id')) return <Tag className="mr-2 h-4 w-4 text-muted-foreground" />;
    if(lowerHeader.includes('model')) return <Package className="mr-2 h-4 w-4 text-muted-foreground" />;
    if(lowerHeader.includes('shelf')) return <Server className="mr-2 h-4 w-4 text-muted-foreground" />;
    if(lowerHeader.includes('rack')) return <Rows className="mr-2 h-4 w-4 text-muted-foreground" />;
    return null;
  }

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
              Sube tu archivo de Excel o CSV para empezar a buscar tus ONUs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isUploading ? (
              <div className="flex flex-col items-center gap-4">
                <Skeleton className="h-10 w-48" />
                <p className="text-sm text-muted-foreground">Procesando archivo...</p>
              </div>
            ) : (
               <Button onClick={handleUpload}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Cargar archivo de demostración
                </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            <h2 className="text-2xl font-headline font-semibold text-center">Búsqueda de Equipos</h2>
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
             <h3 className="text-xl font-headline font-semibold">Resultados de la Búsqueda ({filteredResults.length})</h3>
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
                        <Badge variant={getStatusVariant(row.Status)}>{row.Status}</Badge>
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

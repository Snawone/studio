'use client';

import { useEffect, useState } from 'react';
import { type OnuData } from '@/lib/data';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchCheck, Server, Tag, Trash2, Calendar, PackageX } from "lucide-react";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function SearchListPage() {
  const [searchList, setSearchList] = useState<OnuData[]>([]);
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    try {
      const savedSearchList = localStorage.getItem('onuSearchList');
      if (savedSearchList) {
        setSearchList(JSON.parse(savedSearchList));
      }
    } catch (e) {
      console.error("Failed to load search list from localStorage", e);
    } finally {
      setIsHydrating(false);
    }
  }, []);

  const handleRemoveFromSearchList = (onuId: string) => {
    const updatedList = searchList.filter(onu => onu['ONU ID'] !== onuId);
    setSearchList(updatedList);
    localStorage.setItem('onuSearchList', JSON.stringify(updatedList));
  };
  
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es });
    } catch (e) {
      return 'Fecha inválida';
    }
  };

  if (isHydrating) {
    return <div>Cargando lista de búsqueda...</div>;
  }

  return (
    <section className="w-full max-w-6xl mx-auto flex flex-col gap-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-headline font-semibold flex items-center gap-2">
          <SearchCheck className="h-6 w-6" />
          Lista de Búsqueda
        </h2>
        <p className="text-muted-foreground text-sm">
          Aquí están las ONUs que has marcado para seguir de cerca.
        </p>
      </div>

      <div className="space-y-6">
        {searchList.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchList.map((onu) => (
              <Card key={onu['ONU ID']} className="flex flex-col justify-between">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-mono break-all">
                    <Tag className="h-4 w-4" />
                    {onu['ONU ID']}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-4 pt-2">
                    <span className="flex items-center gap-1">
                      <Server className="h-4 w-4" />
                      <span className="font-medium">{onu.Shelf}</span>
                    </span>
                    {onu.removedDate ? (
                      <Badge variant="destructive">Retirada</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">Activa</Badge>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                   <p className="flex items-center">
                    <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground mr-2">Agregada:</span> 
                    <span className="text-foreground text-xs">{formatDate(onu.addedDate)}</span>
                   </p>
                   {onu.removedDate && (
                    <p className="flex items-center text-destructive/80">
                        <Calendar className="mr-2 h-4 w-4" />
                        <span className="mr-2">Retirada:</span> 
                        <span className="text-xs">{formatDate(onu.removedDate)}</span>
                    </p>
                   )}
                </CardContent>
                <CardFooter>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleRemoveFromSearchList(onu['ONU ID'])}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Quitar de la lista
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <PackageX className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">Tu lista de búsqueda está vacía</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Añade ONUs a esta lista usando el botón "Buscar" en las vistas de activas o retiradas.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

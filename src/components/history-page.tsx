
'use client';

import { useMemo, useState } from 'react';
import { type OnuData, type OnuHistoryEntry } from '@/lib/data';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { History, PackagePlus, FileDown, Trash2, Repeat, Server, Tag, Search, Package } from "lucide-react";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type HistoryPageProps = {
  allOnus: OnuData[];
};

export function HistoryPage({ allOnus }: HistoryPageProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOnus = useMemo(() => {
    if (!allOnus) return [];
    const sorted = [...allOnus].sort((a, b) => {
        const lastEventA = a.history?.[a.history.length - 1]?.date;
        const lastEventB = b.history?.[b.history.length - 1]?.date;
        if (!lastEventA || !lastEventB) return 0;
        return new Date(lastEventB).getTime() - new Date(lastEventA).getTime();
      });

    if (!searchTerm) {
      return sorted;
    }
    return sorted.filter(onu =>
      onu['ONU ID'].toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allOnus, searchTerm]);

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), "d 'de' MMMM, yyyy, HH:mm", { locale: es });
    } catch (e) {
      return 'Fecha inválida';
    }
  };

  const getHistoryIcon = (action: OnuHistoryEntry['action']) => {
    switch (action) {
      case 'created': return <PackagePlus className="h-5 w-5 text-green-500" />;
      case 'added': return <PackagePlus className="h-5 w-5 text-blue-500" />;
      case 'removed': return <Trash2 className="h-5 w-5 text-red-500" />;
      case 'restored': return <Repeat className="h-5 w-5 text-yellow-500" />;
      default: return <History className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getHistoryMessage = (entry: OnuHistoryEntry, onu: OnuData) => {
    switch (entry.action) {
      case 'created': return `Dispositivo creado manualmente en estante ${onu.shelfName}.`;
      case 'added': return `Dispositivo agregado en estante ${onu.shelfName}.`;
      case 'removed': return `Dispositivo retirado del inventario.`;
      case 'restored': return `Dispositivo devuelto al estante ${onu.shelfName}.`;
      default: return `Acción desconocida`;
    }
  };

  return (
    <section className="w-full max-w-6xl mx-auto flex flex-col gap-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-headline font-semibold flex items-center gap-2">
          <History className="h-6 w-6" />
          Historial de Dispositivos
        </h2>
        <p className="text-muted-foreground text-sm">
          Busca y visualiza el ciclo de vida completo de cada dispositivo en el inventario.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buscar Dispositivo por ID</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search-term"
                type="text"
                placeholder={`Buscar entre ${allOnus?.length || 0} dispositivos...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="space-y-6">
        {filteredOnus.length > 0 ? (
          filteredOnus.map((onu) => (
            <Card key={onu.id} className="overflow-hidden">
              <CardHeader className="flex flex-row justify-between items-start bg-muted/30">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-mono">
                    <Tag className="h-4 w-4" />
                    {onu['ONU ID']}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-4 mt-2">
                     <span className="flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        <span className="font-medium">{onu.shelfName}</span>
                     </span>
                     {onu.status === 'removed' ? (
                        <Badge variant="destructive">Retirada</Badge>
                     ) : (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">Activa</Badge>
                     )}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                 <h4 className="font-semibold mb-4 flex items-center gap-2 text-sm"><History className="h-4 w-4" />Línea de tiempo</h4>
                {onu.history && onu.history.length > 0 ? (
                  <ul className="space-y-4 border-l-2 pl-6 ml-2">
                    {[...onu.history].reverse().map((entry, index) => (
                      <li key={index} className="relative">
                         <div className="absolute -left-[30px] top-1/2 -translate-y-1/2 bg-background p-1 rounded-full">
                           {getHistoryIcon(entry.action)}
                         </div>
                        <p className="font-medium text-sm">{getHistoryMessage(entry, onu)}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(entry.date)}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No hay historial para este dispositivo.</p>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <Package className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">
              {searchTerm ? 'No se encontraron dispositivos' : 'No hay dispositivos'}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchTerm
                ? `No se encontraron resultados para "${searchTerm}".`
                : "Cuando se agregue stock, el historial aparecerá aquí."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

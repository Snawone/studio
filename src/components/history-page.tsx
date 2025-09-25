
'use client';

import { useMemo } from 'react';
import { type OnuData, type OnuHistoryEntry } from '@/lib/data';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { History, PackagePlus, FileDown, Trash2, Repeat, Server, Tag } from "lucide-react";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type HistoryPageProps = {
  allOnus: OnuData[];
};

type FormattedHistoryEntry = {
  onu: OnuData;
  entry: OnuHistoryEntry;
};

export function HistoryPage() {
  const allHistoryEvents = useMemo(() => {
    let events: FormattedHistoryEntry[] = [];
    // This component is not receiving the data, so it will be empty.
    // This is a placeholder for when the data is passed in.
    const allOnus: OnuData[] = []; 
    
    allOnus.forEach(onu => {
      if (onu.history) {
        onu.history.forEach(entry => {
          events.push({ onu, entry });
        });
      }
    });

    return events.sort((a, b) => new Date(b.entry.date).getTime() - new Date(a.entry.date).getTime());
  }, []);

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es });
    } catch (e) {
      return 'Fecha inválida';
    }
  };

  const getHistoryIcon = (action: OnuHistoryEntry['action']) => {
    switch (action) {
      case 'created': return <PackagePlus className="h-5 w-5 text-green-500" />;
      case 'added': return <FileDown className="h-5 w-5 text-blue-500" />;
      case 'removed': return <Trash2 className="h-5 w-5 text-red-500" />;
      case 'restored': return <Repeat className="h-5 w-5 text-yellow-500" />;
      default: return <History className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getHistoryMessage = (entry: OnuHistoryEntry) => {
    switch (entry.action) {
      case 'created': return `ONU creada manualmente`;
      case 'added': return `ONU agregada desde archivo`;
      case 'removed': return `ONU retirada del inventario`;
      case 'restored': return `ONU devuelta al inventario`;
      default: return `Acción desconocida`;
    }
  };

  return (
    <section className="w-full max-w-4xl mx-auto flex flex-col gap-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-headline font-semibold flex items-center gap-2">
          <History className="h-6 w-6" />
          Historial de Operaciones
        </h2>
        <p className="text-muted-foreground text-sm">
          Registro cronológico de todas las actividades en el inventario.
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          {allHistoryEvents.length > 0 ? (
            <ul className="space-y-6">
              {allHistoryEvents.map(({ onu, entry }, index) => (
                <li key={index} className="flex items-start gap-4">
                  <div className="mt-1">{getHistoryIcon(entry.action)}</div>
                  <div className="flex-1">
                    <p className="font-medium">{getHistoryMessage(entry)}</p>
                    <div className="text-sm text-muted-foreground space-y-1 mt-1">
                      <p className="flex items-center gap-2 font-mono text-xs">
                        <Tag className="h-3 w-3" />
                        {onu['ONU ID']}
                      </p>
                      <p className="flex items-center gap-2">
                        <Server className="h-3 w-3" />
                        Estante: <strong>{onu.Shelf}</strong>
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap mt-1">{formatDate(entry.date)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground">
                No hay operaciones registradas todavía.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

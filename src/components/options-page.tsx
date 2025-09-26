
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, FileDown, Loader2 } from "lucide-react";
import * as XLSX from 'xlsx';
import { type OnuData } from '@/lib/data';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";

type OptionsPageProps = {
  allOnus: OnuData[];
};

export function OptionsPage({ allOnus }: OptionsPageProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const formatDateForExport = (dateString: string | undefined | null) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm:ss", { locale: es });
    } catch {
      return 'Fecha inválida';
    }
  };

  const handleExport = () => {
    setIsExporting(true);

    try {
      const activeOnus = allOnus.filter(onu => onu.status === 'active');
      
      const dataToExport = activeOnus.map(onu => ({
        'ID': onu.id,
        'Estante': onu.shelfName,
        'Tipo': onu.type.toUpperCase(),
        'Estado': 'Activa',
        'Fecha de Alta': formatDateForExport(onu.addedDate),
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario ONUs Activas");

      // Auto-size columns
      const max_width = dataToExport.reduce((w, r) => Math.max(w, r.ID.length), 10);
      worksheet["!cols"] = [
          { wch: max_width + 5 }, // ID
          { wch: 15 }, // Estante
          { wch: 8 }, // Tipo
          { wch: 10 }, // Estado
          { wch: 20 }, // Fecha de Alta
      ];

      XLSX.writeFile(workbook, "inventario_onus_activas.xlsx");

      toast({
        title: "Exportación exitosa",
        description: `${activeOnus.length} dispositivos activos han sido exportados a Excel.`,
      });

    } catch (error) {
      console.error("Error al exportar a Excel:", error);
      toast({
        variant: "destructive",
        title: "Error de exportación",
        description: "No se pudo generar el archivo de Excel.",
      });
    } finally {
      setIsExporting(false);
    }
  };


  return (
    <section className="w-full max-w-4xl mx-auto flex flex-col gap-8">
        <div className="space-y-2">
            <h2 className="text-2xl font-headline font-semibold flex items-center gap-2">
                <Settings className="h-6 w-6"/>
                Opciones y Herramientas
            </h2>
            <p className="text-muted-foreground text-sm">
                Configuraciones y herramientas adicionales de la aplicación.
            </p>
        </div>
        <Card>
           <CardHeader>
             <CardTitle className="flex items-center gap-2"><FileDown className="h-5 w-5 text-primary"/>Exportar Inventario Activo</CardTitle>
             <CardDescription>
               Descarga un archivo de Excel con la lista de todos los dispositivos actualmente activos en el sistema.
             </CardDescription>
           </CardHeader>
           <CardContent>
             <p className="text-sm text-muted-foreground">
                Se exportarán un total de <strong>{allOnus.filter(onu => onu.status === 'active').length}</strong> dispositivos activos.
             </p>
           </CardContent>
           <CardFooter>
             <Button onClick={handleExport} disabled={isExporting || allOnus.length === 0}>
                {isExporting ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Exportando...
                    </>
                ) : (
                    <>
                        <FileDown className="mr-2 h-4 w-4" />
                        Exportar a Excel
                    </>
                )}
             </Button>
           </CardFooter>
         </Card>
    </section>
  );
}

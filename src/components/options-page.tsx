
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Settings, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as XLSX from 'xlsx';
import { OnuData } from "@/lib/data";

interface OptionsPageProps {
  allOnus: OnuData[];
}

export function OptionsPage({ allOnus }: OptionsPageProps) {

  const handleExportByShelf = () => {
    // 1. Filter for active devices
    const activeOnus = allOnus.filter(onu => onu.status === 'active');
    
    // 2. Group by shelf name
    const groupedByShelf = activeOnus.reduce((acc, onu) => {
      const shelfName = onu.shelfName;
      if (!acc[shelfName]) {
        acc[shelfName] = [];
      }
      acc[shelfName].push(onu.id);
      return acc;
    }, {} as Record<string, string[]>);

    // 3. Prepare data for worksheet
    const shelfNames = Object.keys(groupedByShelf).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    
    // Find the maximum number of devices in any shelf to determine the number of rows
    const maxRows = Math.max(0, ...shelfNames.map(name => groupedByShelf[name].length));

    // Create the data array for the sheet
    const sheetData: (string | null)[][] = [];

    // Header row with shelf names
    sheetData.push(shelfNames);

    // Data rows
    for (let i = 0; i < maxRows; i++) {
      const row: (string | null)[] = [];
      for (const shelfName of shelfNames) {
        row.push(groupedByShelf[shelfName][i] || null);
      }
      sheetData.push(row);
    }
    
    // 4. Create worksheet and workbook
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario por Estante');

    // 5. Trigger download
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
    </section>
  );
}

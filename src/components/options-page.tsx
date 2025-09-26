
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Settings } from "lucide-react";

export function OptionsPage() {
  return (
    <section className="w-full max-w-4xl mx-auto flex flex-col gap-8">
        <div className="space-y-2">
            <h2 className="text-2xl font-headline font-semibold flex items-center gap-2">
                <Settings className="h-6 w-6"/>
                Opciones
            </h2>
            <p className="text-muted-foreground text-sm">
                Configuraciones y ajustes generales de la aplicación.
            </p>
        </div>
        <Card>
           <CardHeader>
             <CardTitle>Sección en Desarrollo</CardTitle>
             <CardDescription>
               Este apartado está reservado para futuras opciones de configuración de la aplicación.
             </CardDescription>
           </CardHeader>
           <CardContent>
             <div className="text-center py-12 border-2 border-dashed rounded-lg">
               <p className="text-muted-foreground">
                 ¡Próximamente encontrarás nuevas funcionalidades aquí!
               </p>
             </div>
           </CardContent>
         </Card>
    </section>
  );
}

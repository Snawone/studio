
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Settings, Wrench } from "lucide-react";

export function OptionsPage() {
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
            <Wrench className="h-5 w-5 text-primary" />
            Sección en Desarrollo
          </CardTitle>
          <CardDescription>
            Este espacio está reservado para futuras herramientas y configuraciones de la aplicación.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Vuelve más tarde para ver las nuevas funcionalidades que se agregarán aquí.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

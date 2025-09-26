
"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";

export function TechnicalGroupsPage() {
  return (
    <section className="w-full max-w-4xl mx-auto flex flex-col gap-8">
        <div className="space-y-2">
            <h2 className="text-2xl font-headline font-semibold flex items-center gap-2">
                <Users className="h-6 w-6"/>
                Grupos Técnicos
            </h2>
            <p className="text-muted-foreground text-sm">
                Gestiona los grupos de técnicos y los dispositivos que tienen asignados.
            </p>
        </div>
      <Card>
        <CardHeader>
          <CardTitle>Sección en Desarrollo</CardTitle>
          <CardDescription>
            Este apartado está reservado para la gestión de grupos técnicos.
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

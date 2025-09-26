'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { doc, getDocs, writeBatch, collection, query, where, documentId } from 'firebase/firestore';
import { Users, Loader2, AlertTriangle, Server, Box } from 'lucide-react';
import { type Shelf, type OnuData, type OnuHistoryEntry } from '@/lib/data';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuthContext } from '@/firebase/auth/auth-provider';


const deviceSchema = z.object({
  ids: z.string().min(1, "Debe ingresar al menos un ID de dispositivo."),
  shelfId: z.string().min(1, "Debe seleccionar un estante."),
  type: z.enum(['onu', 'stb'], { required_error: "Debe seleccionar un tipo." }),
});

type DeviceFormValues = z.infer<typeof deviceSchema>;

export function TechnicalGroupsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { profile } = useAuthContext();
  const [isAddingDevice, setIsAddingDevice] = useState(false);

  const shelvesCollectionRef = useMemoFirebase(() => collection(firestore, 'shelves'), [firestore]);
  const { data: allShelves, isLoading: isLoadingShelves } = useCollection<Shelf>(shelvesCollectionRef);

  const deviceForm = useForm<DeviceFormValues>({
    resolver: zodResolver(deviceSchema),
    defaultValues: { ids: '', shelfId: '', type: undefined },
  });

  const handleAddDevices = async (values: DeviceFormValues) => {
    // This logic will be replaced
  };

  return (
    <section className="w-full max-w-4xl mx-auto flex flex-col gap-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-headline font-semibold flex items-center gap-2">
          <Users className="h-6 w-6" />
          Gestión de Grupos Técnicos
        </h2>
        <p className="text-muted-foreground text-sm">
          Crea, edita y administra tus grupos de técnicos.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5 text-primary"/>Crear Nuevo Grupo</CardTitle>
          <CardDescription>
            Rellena los detalles para crear un nuevo grupo técnico.
          </CardDescription>
        </CardHeader>
        {isLoadingShelves ? (
            <CardContent><Loader2 className="animate-spin"/></CardContent>
        ) : (
          <Form {...deviceForm}>
            <form onSubmit={deviceForm.handleSubmit(handleAddDevices)}>
              <CardContent className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={deviceForm.control}
                      name="ids"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre del Grupo</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Ej: Equipo de Instalaciones A" 
                              className="h-32"
                              {...field} 
                              autoFocus 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className='space-y-4'>
                    <FormField
                      control={deviceForm.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Técnicos</FormLabel>
                          <Select onValueChange={field.onChange} 
                            value={field.value} defaultValue="">
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Seleccionar técnicos..." /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {/* Technician list will go here */}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isAddingDevice}>
                    {isAddingDevice && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Users className="mr-2 h-4 w-4"/>
                    {isAddingDevice ? 'Creando...' : 'Crear Grupo'}
                </Button>
              </CardFooter>
            </form>
          </Form>
        )}
      </Card>
    </section>
  );
}

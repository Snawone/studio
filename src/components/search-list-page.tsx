'use client';

import { useState } from 'react';
import { type OnuData } from '@/lib/data';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchCheck, Server, Tag, Trash2, Calendar, PackageX, CheckCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useFirestore } from '@/firebase';
import { writeBatch, doc } from 'firebase/firestore';

type SearchListPageProps = {
  searchList: OnuData[];
  userId: string;
}

export function SearchListPage({ searchList, userId }: SearchListPageProps) {
  const firestore = useFirestore();
  const [onuToRetire, setOnuToRetire] = useState<OnuData | null>(null);
  const [isConfirmRetireAllOpen, setIsConfirmRetireAllOpen] = useState(false);

  const handleRemoveFromSearchList = (onuId: string) => {
    const docRef = doc(firestore, 'users', userId, 'onus', onuId);
    const batch = writeBatch(firestore);
    batch.update(docRef, { inSearch: false });
    batch.commit();
  };
  
  const handleRetireOnu = (onuToRetire: OnuData) => {
    const removedDate = new Date().toISOString();
    const docRef = doc(firestore, 'users', userId, 'onus', onuToRetire.id);
    const batch = writeBatch(firestore);

    batch.update(docRef, {
      status: 'removed',
      inSearch: false,
      removedDate: removedDate,
      history: [...(onuToRetire.history || []), { action: 'removed', date: removedDate }]
    });

    batch.commit();
    setOnuToRetire(null);
  };

  const handleRetireAll = () => {
    const date = new Date().toISOString();
    const batch = writeBatch(firestore);

    searchList.forEach(onuInSearch => {
      const docRef = doc(firestore, 'users', userId, 'onus', onuInSearch.id);
      batch.update(docRef, {
        status: 'removed',
        inSearch: false,
        removedDate: date,
        history: [...(onuInSearch.history || []), { action: 'removed', date }]
      });
    });
    
    batch.commit();
    setIsConfirmRetireAllOpen(false);
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es });
    } catch (e) {
      return 'Fecha inválida';
    }
  };


  return (
    <section className="w-full max-w-6xl mx-auto flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-headline font-semibold flex items-center gap-2">
            <SearchCheck className="h-6 w-6" />
            Lista de Búsqueda ({searchList.length})
          </h2>
          <p className="text-muted-foreground text-sm">
            Aquí están las ONUs que has marcado. Puedes marcarlas como encontradas individualmente o todas a la vez.
          </p>
        </div>
        {searchList.length > 0 && (
            <Button onClick={() => setIsConfirmRetireAllOpen(true)}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Marcar todas como encontradas
            </Button>
        )}
      </div>

      <div className="space-y-6">
        {searchList.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchList.map((onu) => (
              <Card key={onu.id} className="flex flex-col justify-between">
                <div>
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
                            {onu.status === 'removed' ? (
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
                </div>
                <CardFooter className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleRemoveFromSearchList(onu.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Quitar
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => setOnuToRetire(onu)}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Encontrada
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
      
      {/* Individual Retire Confirmation */}
      <AlertDialog open={!!onuToRetire} onOpenChange={(open) => !open && setOnuToRetire(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Marcar como encontrada?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto moverá la ONU <strong className='break-all'>{onuToRetire?.['ONU ID']}</strong> a la lista de "Retiradas" y la quitará de la lista de búsqueda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOnuToRetire(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => onuToRetire && handleRetireOnu(onuToRetire)}>
              Sí, marcar como encontrada
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Retire All Confirmation */}
      <AlertDialog open={isConfirmRetireAllOpen} onOpenChange={setIsConfirmRetireAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Marcar todas como encontradas?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto moverá las {searchList.length} ONUs de esta lista a "Retiradas" (si están activas) y limpiará la lista de búsqueda. ¿Estás seguro?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRetireAll}>
              Sí, marcar todas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

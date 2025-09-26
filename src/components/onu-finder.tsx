
"use client";

import { useState, useMemo, useTransition, useRef, useEffect, Dispatch, SetStateAction } from "react";
import { type OnuData, type OnuHistoryEntry, type Shelf } from "@/lib/data";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger, 
    DialogFooter,
    DialogClose,
    DialogDescription
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Server, Tag, Loader2, Calendar as CalendarIcon, Trash2, RotateCcw, History, PackagePlus, Repeat, SearchCheck, Check, User } from "lucide-react";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useFirestore } from "@/firebase";
import { doc, writeBatch, increment } from "firebase/firestore";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useAuthContext } from "@/firebase/auth/auth-provider";

type OnuFinderProps = {
    activeView: 'activas' | 'retiradas';
    onus: OnuData[];
    searchList: string[];
    userId: string;
    isLoadingOnus: boolean;
}

export function OnuFinder({ 
  activeView, 
  onus,
  searchList,
  userId,
  isLoadingOnus,
}: OnuFinderProps) {
  const firestore = useFirestore();
  const { profile } = useAuthContext();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isPending, startTransition] = useTransition();

  const [onuToManage, setOnuToManage] = useState<OnuData | null>(null);
  const [isConfirmRetireOpen, setIsConfirmRetireOpen] = useState(false);
  const [isConfirmRestoreOpen, setIsConfirmRestoreOpen] = useState(false);

  const handleConfirmRetire = () => {
    if (onuToManage) {
        const removedDate = new Date().toISOString();
        
        const onuRef = doc(firestore, 'onus', onuToManage.id);
        const shelfRef = doc(firestore, 'shelves', onuToManage.shelfId);

        const batch = writeBatch(firestore);

        const historyEntry: OnuHistoryEntry = { 
          action: 'removed', 
          date: removedDate,
          userId: profile?.id,
          userName: profile?.name,
        };

        batch.update(onuRef, {
          status: 'removed',
          removedDate: removedDate,
          history: [...(onuToManage.history || []), historyEntry]
        });

        batch.update(shelfRef, { itemCount: increment(-1) });
        
        batch.commit();
    }
    setIsConfirmRetireOpen(false);
    setOnuToManage(null);
  };
  
  const handleConfirmRestore = () => {
    if (onuToManage) {
      const restoredDate = new Date().toISOString();
      const onuRef = doc(firestore, 'onus', onuToManage.id);
      const shelfRef = doc(firestore, 'shelves', onuToManage.shelfId);

      const batch = writeBatch(firestore);

      const historyEntry: OnuHistoryEntry = {
        action: 'restored',
        date: restoredDate,
        userId: profile?.id,
        userName: profile?.name,
      };
      
      batch.update(onuRef, {
        status: 'active',
        removedDate: null,
        history: [...(onuToManage.history || []), historyEntry]
      });

      batch.update(shelfRef, { itemCount: increment(1) });
      
      batch.commit();
    }
    setIsConfirmRestoreOpen(false);
    setOnuToManage(null);
  };

  const handleToggleSearchList = (onu: OnuData) => {
    const userDocRef = doc(firestore, 'users', userId);
    let newSearchList;
    if (searchList.includes(onu.id)) {
      newSearchList = searchList.filter(id => id !== onu.id);
    } else {
      newSearchList = [...searchList, onu.id];
    }
    updateDocumentNonBlocking(userDocRef, { searchList: newSearchList });
  };

  const filteredResults = useMemo(() => {
    const viewFilter = activeView === 'activas' ? 'active' : 'removed';
    const relevantOnus = onus.filter(onu => onu.status === viewFilter);
    if (!searchTerm) return relevantOnus;
    
    return relevantOnus.filter((row) => 
        row.id?.toString().toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, onus, activeView]);
  
  const formatDate = (dateString: string | undefined, includeTime = false) => {
    if (!dateString) return 'N/A';
    try {
      const formatString = includeTime ? "dd/MM/yyyy, HH:mm" : "dd/MM/yyyy";
      return format(new Date(dateString), formatString, { locale: es });
    } catch (e) {
      return 'Fecha inválida';
    }
  };

  const getHistoryIcon = (action: OnuHistoryEntry['action']) => {
    switch (action) {
      case 'created': return <PackagePlus className="h-4 w-4 text-green-500" />;
      case 'added': return <PackagePlus className="h-4 w-4 text-blue-500" />; // Re-using icon
      case 'removed': return <Trash2 className="h-4 w-4 text-red-500" />;
      case 'restored': return <Repeat className="h-4 w-4 text-yellow-500" />;
      default: return <History className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getHistoryMessage = (entry: OnuHistoryEntry) => {
    const baseMessage = (() => {
        switch (entry.action) {
            case 'created': return `Creada manualmente`;
            case 'added': return `Agregada al inventario`;
            case 'removed': return `Retirada del inventario`;
            case 'restored': return `Devuelta al inventario`;
            default: return `Acción desconocida`;
        }
    })();

    if (entry.userName) {
        return `${baseMessage} por: ${entry.userName}`;
    }

    return baseMessage;
}

  const renderOnuCard = (row: OnuData, index: number) => {
    const isRetired = row.status === 'removed';
    const isExactMatch = searchTerm.length > 0 && row.id.toLowerCase() === searchTerm.toLowerCase();
    const onuId = row.id;
    const idPrefix = onuId.slice(0, -6);
    const idSuffix = onuId.slice(-6);
    const isInSearchList = searchList.includes(row.id);
    
    const creationEntry = row.history?.find(h => h.action === 'created' || h.action === 'added');
    const creatorName = creationEntry?.userName;
  
    return (
      <Card key={`${row.id}-${index}`} className={`group flex flex-col justify-between transition-all duration-300 ${isExactMatch ? 'border-primary shadow-lg scale-105' : ''} ${isInSearchList ? 'border-blue-500' : ''}`}>
        <div>
          <CardHeader className="pb-2">
             <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                    <Tag className="mr-1 h-4 w-4 flex-shrink-0 mt-1 text-primary"/>
                    <CardTitle className="flex items-baseline text-base text-primary break-all font-mono">
                        <div>
                            {isExactMatch ? (
                            <>
                                <span className="text-muted-foreground">{idPrefix}</span>
                                <span className="font-bold text-lg text-foreground">{idSuffix}</span>
                            </>
                            ) : (
                            onuId
                            )}
                        </div>
                        <Badge variant={row.type === 'onu' ? 'outline' : 'secondary'} className="text-xs ml-2">{row.type.toUpperCase()}</Badge>
                    </CardTitle>
                </div>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                            <History className="h-4 w-4" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Historial de la ONU</DialogTitle>
                            <DialogDescription className="font-mono break-all pt-2">{row.id}</DialogDescription>
                        </DialogHeader>
                        <div className="max-h-80 overflow-y-auto pr-4">
                            <ul className="space-y-4 mt-4">
                                {[...(row.history || [])].reverse().map((entry, idx) => (
                                    <li key={idx} className="flex items-start gap-3">
                                        <div className="mt-1">{getHistoryIcon(entry.action)}</div>
                                        <div>
                                            <p className="font-medium text-sm">{getHistoryMessage(entry)}</p>
                                            <p className="text-xs text-muted-foreground">{formatDate(entry.date, true)}</p>
                                            {entry.userName && (
                                                <p className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" />{entry.userName}</p>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm pt-2">
            <p className="flex items-center font-medium">
              <Server className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground mr-2">Estante:</span> 
              <span className={`font-bold text-foreground ${isExactMatch ? 'text-lg' : ''}`}>{row.shelfName}</span>
            </p>
            <div className="flex items-start gap-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground mt-0.5"/>
                <div>
                    <p className="font-medium">
                        <span className="text-muted-foreground mr-2">Agregada:</span>
                        <span className="text-foreground text-xs">{formatDate(row.addedDate, true)}</span>
                    </p>
                    {creatorName && (
                        <p className="text-xs text-muted-foreground mt-1">
                            Por: {creatorName}
                        </p>
                    )}
                </div>
            </div>
            {isRetired && row.removedDate && (
               <p className="flex items-center font-medium text-destructive/80">
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span className="mr-2">Retirada:</span> 
                  <span className="text-xs">{formatDate(row.removedDate, true)}</span>
              </p>
            )}
          </CardContent>
        </div>
        <CardFooter className="p-2 bg-muted/30 grid grid-cols-2 gap-2">
           <Button
             variant="outline"
             size="sm"
             className={`w-full ${isInSearchList ? 'bg-blue-100 text-blue-700 border-blue-500/50 hover:bg-blue-200' : ''}`}
             onClick={() => handleToggleSearchList(row)}
           >
            {isInSearchList ? <Check className="mr-2 h-4 w-4" /> : <SearchCheck className="mr-2 h-4 w-4" />}
             {isInSearchList ? 'En lista' : 'Buscar'}
           </Button>
          {isRetired ? (
            <Button 
              variant="outline"
              size="sm"
              className="w-full text-green-600 hover:text-green-700 hover:bg-green-50 border-green-600/50"
              onClick={() => {
                setOnuToManage(row);
                setIsConfirmRestoreOpen(true);
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Devolver
            </Button>
          ) : (
            <Button 
              variant="outline"
              size="sm"
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/50"
              onClick={() => {
                setOnuToManage(row);
                setIsConfirmRetireOpen(true);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Retirar
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  }

  const renderResults = () => (
    <div className="space-y-4">
        {filteredResults && filteredResults.length > 0 ? (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
               {filteredResults.map((onu, index) => renderOnuCard(onu, index))}
           </div>
        ) : (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">
                  {searchTerm 
                    ? <>No se encontraron resultados para <strong className="text-foreground">"{searchTerm}"</strong>.</>
                    : activeView === 'activas' 
                        ? "No hay ONUs activas para mostrar. Ve a 'Cargar Stock' para empezar."
                        : "No hay ONUs retiradas."
                  }
                </p>
            </div>
        )}
    </div>
  );
  
  if (isLoadingOnus) {
    return (
        <section className="w-full max-w-7xl mx-auto flex flex-col gap-8">
            <div className="space-y-4">
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-6 w-2/3" />
            </div>
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/4" />
                    <Skeleton className="h-6 w-1/2" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-10 w-1/2" />
                </CardContent>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                {[...Array(8)].map((_, i) => ( 
                  <Skeleton key={i} className="h-48 w-full" />
                ))}
            </div>
        </section>
    );
  }

  return (
    <section className="w-full max-w-7xl mx-auto flex flex-col gap-8">
         <div className="space-y-4">
            <div className="flex justify-between items-start gap-4 flex-wrap">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-headline font-semibold">
                            {activeView === 'activas' ? `Inventario de ONUs Activas (${onus.filter(o => o.status === 'active').length})` : `ONUs Retiradas (${onus.filter(o => o.status === 'removed').length})`}
                        </h2>
                    </div>
                    <p className="text-muted-foreground text-sm mt-1">
                        {activeView === 'activas' ? 'Visualiza y gestiona las ONUs disponibles en los estantes.' : 'Consulta el historial de ONUs que han sido retiradas.'}
                    </p>
                </div>
            </div>
         </div>

         <Card>
            <CardHeader>
                <CardTitle>Búsqueda Rápida</CardTitle>
                <CardDescription>Busca por ID en la vista actual.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-xl">
                <Label htmlFor="search-term">ID de la ONU/STB</Label>
                <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    id="search-term"
                    type="text"
                    placeholder={`Buscar entre ${filteredResults?.length || 0} dispositivos...`}
                    value={searchTerm}
                    onChange={(e) => {
                      startTransition(() => {
                          setSearchTerm(e.target.value);
                      });
                    }}
                    className="pl-10 w-full"
                />
                </div>
              </div>
            </CardContent>
         </Card>
          
        <div className="mt-6">
            {isPending ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => ( 
                      <Skeleton key={i} className="h-48 w-full" />
                    ))}
                </div>
            ) : (
              renderResults()
            )}
        </div>

      {/* Confirmation Dialogs */}
      <AlertDialog open={isConfirmRetireOpen} onOpenChange={setIsConfirmRetireOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción marcará el dispositivo <strong className="break-all">{onuToManage?.id}</strong> como retirado. Esto disminuirá el contador de items en el estante <strong>{onuToManage?.shelfName}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOnuToManage(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRetire} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sí, retirar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={isConfirmRestoreOpen} onOpenChange={setIsConfirmRestoreOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar devolución?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción devolverá el dispositivo <strong className="break-all">{onuToManage?.id}</strong> a la lista de activos y aumentará el contador de items en el estante <strong>{onuToManage?.shelfName}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOnuToManage(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRestore}>
              Sí, devolver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

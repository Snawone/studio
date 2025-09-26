

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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
import { Search, Server, Tag, Loader2, Calendar as CalendarIcon, Trash2, RotateCcw, History, PackagePlus, Repeat, SearchCheck, Check, User, Info, ArchiveRestore } from "lucide-react";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useFirestore } from "@/firebase";
import { doc, writeBatch, increment } from "firebase/firestore";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useAuthContext } from "@/firebase/auth/auth-provider";

type OnuFinderProps = {
    activeView: 'activas' | 'retiradas';
    onus: OnuData[];
    shelves: Shelf[];
    searchList: string[];
    userId: string;
    isLoadingOnus: boolean;
}

export function OnuFinder({ 
  activeView, 
  onus,
  shelves,
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
  
  // States for the new restore dialog
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [restoreTargetShelfId, setRestoreTargetShelfId] = useState<string | null>(null);
  const [isSubmittingRestore, setIsSubmittingRestore] = useState(false);


  const handleConfirmRetire = () => {
    if (onuToManage && profile) {
        const removedDate = new Date().toISOString();
        
        const onuRef = doc(firestore, 'onus', onuToManage.id);
        const shelfRef = doc(firestore, 'shelves', onuToManage.shelfId);

        const batch = writeBatch(firestore);

        const historyEntry: OnuHistoryEntry = { 
          action: 'removed', 
          date: removedDate,
          userId: profile.id,
          userName: profile.name,
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

  const handleConfirmRestore = async () => {
    if (!onuToManage || !profile || !restoreTargetShelfId) return;

    setIsSubmittingRestore(true);

    const restoredDate = new Date().toISOString();
    const batch = writeBatch(firestore);
    const onuRef = doc(firestore, 'onus', onuToManage.id);
    
    const targetShelf = shelves.find(s => s.id === restoreTargetShelfId);
    if (!targetShelf) {
        console.error("Target shelf not found");
        setIsSubmittingRestore(false);
        return;
    }

    const historyMessage = onuToManage.shelfId === targetShelf.id 
      ? `Dispositivo devuelto al estante original ${targetShelf.name}.`
      : `Dispositivo reubicado al estante ${targetShelf.name}.`;

    const historyEntry: OnuHistoryEntry = {
        action: 'restored',
        date: restoredDate,
        userId: profile.id,
        userName: profile.name,
        description: historyMessage
    };

    // Update ONU document
    batch.update(onuRef, {
        status: 'active',
        removedDate: null,
        addedDate: restoredDate,
        shelfId: targetShelf.id,
        shelfName: targetShelf.name,
        history: [...(onuToManage.history || []), historyEntry]
    });

    // Increment target shelf count
    batch.update(doc(firestore, 'shelves', targetShelf.id), { itemCount: increment(1) });
    
    // Decrement original shelf count if it's different
    if (onuToManage.shelfId !== targetShelf.id) {
        batch.update(doc(firestore, 'shelves', onuToManage.shelfId), { itemCount: increment(-1) });
    }

    await batch.commit();

    setIsSubmittingRestore(false);
    setIsRestoreDialogOpen(false);
    setOnuToManage(null);
    setRestoreTargetShelfId(null);
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

  const groupedOnus = useMemo(() => {
    const viewFilter = activeView === 'activas' ? 'active' : 'removed';
    const relevantOnus = onus.filter(onu => onu.status === viewFilter);
    let filteredOnus = relevantOnus;

    if (searchTerm) {
      filteredOnus = relevantOnus.filter(onu => onu.id.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    
    return filteredOnus.reduce((acc, onu) => {
        (acc[onu.shelfName] = acc[onu.shelfName] || []).push(onu);
        return acc;
    }, {} as Record<string, OnuData[]>);

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
     if (entry.description) {
      return entry.description;
    }
    const baseMessage = (() => {
        switch (entry.action) {
            case 'created': return `Dispositivo creado.`;
            case 'added': return `Agregada al inventario`;
            case 'removed': return `Retirada del inventario`;
            case 'restored': return `Dispositivo devuelto al inventario.`;
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
    
    const lastActiveEntry = row.history?.slice().reverse().find(h => h.action === 'created' || h.action === 'added' || h.action === 'restored');
    const creatorName = lastActiveEntry?.userName;
    const addedDateLabel = lastActiveEntry?.action === 'restored' ? 'Reingresada:' : 'Agregada:';
  
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
                            <DialogTitle>Historial del Dispositivo</DialogTitle>
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
                        <span className="text-muted-foreground mr-2">{addedDateLabel}</span>
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
                setRestoreTargetShelfId(null);
                setIsRestoreDialogOpen(true);
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

  const renderResults = () => {
    const sortedShelfNames = Object.keys(groupedOnus).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    return (
        <div className="space-y-4">
            {sortedShelfNames.length > 0 ? (
                <Accordion type="single" collapsible className="w-full" defaultValue={sortedShelfNames.length > 0 ? sortedShelfNames[0] : undefined}>
                    {sortedShelfNames.map(shelfName => {
                      const shelfOnus = groupedOnus[shelfName];
                      const onuCount = shelfOnus.filter(d => d.type === 'onu').length;
                      const stbCount = shelfOnus.filter(d => d.type === 'stb').length;
                      
                      return (
                        <AccordionItem value={shelfName} key={shelfName}>
                            <AccordionTrigger>
                                <div className="flex items-center gap-2">
                                    <Server className="h-5 w-5 text-muted-foreground" />
                                    <span>{shelfName}</span>
                                    <div className="text-xs text-muted-foreground flex gap-2">
                                      {onuCount > 0 && <span>ONUs: {onuCount}</span>}
                                      {stbCount > 0 && <span>STBs: {stbCount}</span>}
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-2">
                                    {shelfOnus.map((onu, index) => renderOnuCard(onu, index))}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    )})}
                </Accordion>
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
};
  
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
  
  const originalShelf = shelves.find(s => s.id === onuToManage?.shelfId);
  const originalShelfHasSpace = originalShelf ? originalShelf.itemCount < originalShelf.capacity : false;
  
  const availableShelves = shelves.filter(s => 
    s.id !== onuToManage?.shelfId &&
    s.type === onuToManage?.type &&
    s.itemCount < s.capacity
  );

  const statusFilter = activeView === 'activas' ? 'active' : 'removed';
  const currentViewOnusCount = onus.filter(o => o.status === statusFilter).length;

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
                    placeholder={`Buscar entre ${currentViewOnusCount} dispositivos...`}
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
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
            ) : (
              renderResults()
            )}
        </div>

      {/* Retire Confirmation Dialog */}
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
      
      {/* Restore Dialog */}
      <Dialog open={isRestoreDialogOpen} onOpenChange={setIsRestoreDialogOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><ArchiveRestore className="h-5 w-5"/>Devolver Dispositivo</DialogTitle>
                <DialogDescription>
                    Selecciona dónde quieres reingresar el dispositivo <strong className="font-mono break-all">{onuToManage?.id}</strong>.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className={`p-3 rounded-md border ${originalShelfHasSpace ? 'border-green-500 bg-green-50' : 'border-yellow-500 bg-yellow-50'}`}>
                   <div className="flex items-start gap-3">
                     <Info className={`h-5 w-5 mt-0.5 ${originalShelfHasSpace ? 'text-green-600' : 'text-yellow-600'}`} />
                     <div>
                        <h4 className="font-semibold">Estante Original: {originalShelf?.name}</h4>
                        {originalShelfHasSpace ? (
                            <p className="text-sm text-green-700">Hay espacio disponible en este estante.</p>
                        ) : (
                            <p className="text-sm text-yellow-700">Este estante está lleno. No se puede devolver aquí.</p>
                        )}
                     </div>
                   </div>
                   {originalShelfHasSpace && (
                      <Button 
                        size="sm" 
                        className="w-full mt-3"
                        onClick={() => setRestoreTargetShelfId(originalShelf!.id)}
                        variant={restoreTargetShelfId === originalShelf!.id ? 'default' : 'outline'}
                      >
                        {restoreTargetShelfId === originalShelf!.id && <Check className="mr-2 h-4 w-4"/>}
                        Devolver a {originalShelf?.name}
                      </Button>
                   )}
                </div>
                
                {availableShelves.length > 0 && (
                    <div>
                        <Label htmlFor="shelf-select">O reubicar en otro estante:</Label>
                        <Select
                            onValueChange={(value) => setRestoreTargetShelfId(value)}
                            value={restoreTargetShelfId && restoreTargetShelfId !== originalShelf?.id ? restoreTargetShelfId : ""}
                        >
                            <SelectTrigger id="shelf-select" className="mt-1">
                                <SelectValue placeholder="Seleccionar un nuevo estante..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableShelves.map(shelf => (
                                    <SelectItem key={shelf.id} value={shelf.id}>
                                        {shelf.name} ({shelf.itemCount}/{shelf.capacity})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>
            <DialogFooter className="sm:justify-between gap-2">
                 <DialogClose asChild>
                    <Button type="button" variant="secondary">
                        Cancelar
                    </Button>
                </DialogClose>
                <Button 
                    type="button" 
                    onClick={handleConfirmRestore}
                    disabled={!restoreTargetShelfId || isSubmittingRestore}
                >
                    {isSubmittingRestore && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    {isSubmittingRestore ? 'Guardando...' : 'Confirmar Devolución'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}


"use client";

import { useState, useMemo, useTransition, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { type OnuData, type OnuHistoryEntry, type FileInfo } from "@/lib/data";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { FileSpreadsheet, Search, Upload, Server, Tag, Link, AlertTriangle, PlusCircle, RotateCcw, Loader2, Calendar as CalendarIcon, Trash2, History, PackagePlus, FileDown, Repeat, SearchCheck, Check, File, XCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useFirestore } from "@/firebase";
import { writeBatch, doc, updateDoc, setDoc } from "firebase/firestore";
import { setDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useAuthContext } from "@/firebase/auth/auth-provider";
import { getStorage, ref, uploadBytes, getDownloadURL, getBytes } from "firebase/storage";

type OnuFinderProps = {
    activeView: 'activas' | 'retiradas';
    onusFromFirestore: OnuData[];
    searchList: string[];
    allShelves: string[];
    userId: string;
    fileInfo: FileInfo | null;
    isLoadingOnus: boolean;
}

type OnuFromSheet = {
  'ONU ID': string;
  'Shelf': string;
}

export function OnuFinder({ 
  activeView, 
  onusFromFirestore,
  searchList,
  allShelves,
  userId,
  fileInfo,
  isLoadingOnus
}: OnuFinderProps) {
  const firestore = useFirestore();
  const { profile } = useAuthContext();
  const storage = getStorage();
  
  const [onusFromCloudSheet, setOnusFromCloudSheet] = useState<OnuFromSheet[]>([]);
  const [onusFromLocalFile, setOnusFromLocalFile] = useState<OnuFromSheet[]>([]);
  const [localFileName, setLocalFileName] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localFileInputRef = useRef<HTMLInputElement>(null);

  const [newOnuId, setNewOnuId] = useState('');
  const [newOnuShelf, setNewOnuShelf] = useState('');
  const [isAddOnuOpen, setIsAddOnuOpen] = useState(false);

  const [onuToManage, setOnuToManage] = useState<OnuData | null>(null);
  const [isConfirmRetireOpen, setIsConfirmRetireOpen] = useState(false);
  const [isConfirmRestoreOpen, setIsConfirmRestoreOpen] = useState(false);
  
  const [mergedOnus, setMergedOnus] = useState<OnuData[]>([]);

  useEffect(() => {
      const fetchAndProcessFile = async () => {
        if (!fileInfo || !fileInfo.fileUrl) {
          setOnusFromCloudSheet([]);
          return;
        }

        setError(null);
        try {
          const storageRef = ref(storage, fileInfo.fileUrl);
          const arrayBuffer = await getBytes(storageRef);
          
          const jsonData = processExcel(arrayBuffer, fileInfo.sheetName);
          setOnusFromCloudSheet(jsonData);

        } catch (err: any) {
          console.error("Error fetching or processing file:", err);
          setError(err.message || 'No se pudo obtener o procesar el archivo desde la URL.');
          setOnusFromCloudSheet([]);
        } 
      };
      
      fetchAndProcessFile();
  }, [fileInfo, storage]);


  const processExcel = (arrayBuffer: ArrayBuffer, sheetName?: string) => {
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const targetSheetName = sheetName || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[targetSheetName];
      const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

      if (jsonData.length < 2) {
        throw new Error('La hoja de cálculo está vacía o tiene un formato incorrecto.');
      }

      const headers = jsonData[0].map(h => String(h || '').trim());
      const allOnus: OnuFromSheet[] = [];

      for (let colIndex = 0; colIndex < headers.length; colIndex++) {
          const shelf = headers[colIndex];
          if (shelf) {
              for (let rowIndex = 1; rowIndex < jsonData.length; rowIndex++) {
                  const row = jsonData[rowIndex];
                  if(row) {
                      const onuId = row[colIndex];
                      if (onuId !== null && onuId !== undefined && String(onuId).trim() !== '') {
                          allOnus.push({
                              'ONU ID': String(onuId),
                              'Shelf': shelf,
                          });
                      }
                  }
              }
          }
      }
      return allOnus;
  }

  useEffect(() => {
    const onusFromSheet = localFileName ? onusFromLocalFile : onusFromCloudSheet;
    
    if (!onusFromSheet.length) {
      setMergedOnus(onusFromFirestore.filter(onu => onu.status === activeView.slice(0, -1)));
      return;
    }

    const firestoreMap = new Map(onusFromFirestore.map(onu => [onu.id, onu]));
    
    const combined = onusFromSheet.map(sheetOnu => {
      const firestoreData = firestoreMap.get(sheetOnu['ONU ID']);
      return {
        id: sheetOnu['ONU ID'],
        'ONU ID': sheetOnu['ONU ID'],
        'Shelf': sheetOnu['Shelf'],
        status: firestoreData?.status || 'active',
        addedDate: firestoreData?.addedDate || new Date().toISOString(),
        removedDate: firestoreData?.removedDate,
        history: firestoreData?.history || [],
      };
    });
    
    setMergedOnus(combined.filter(onu => onu.status === (activeView === 'activas' ? 'active' : 'removed')));
  }, [onusFromCloudSheet, onusFromLocalFile, localFileName, onusFromFirestore, activeView]);
  

  const handleCloudUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    try {
      const filePath = `inventory/onus.xlsx`;
      const storageRef = ref(storage, filePath);
      await uploadBytes(storageRef, file);
      
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];

      const fileInfoRef = doc(firestore, 'settings', 'fileInfo');
      const newFileInfo: FileInfo = {
          fileName: file.name,
          fileUrl: filePath,
          sheetName: sheetName,
          lastUpdated: new Date().toISOString(),
      };
      await setDoc(fileInfoRef, newFileInfo);
      
    } catch (err: any) {
      console.error("Error during file upload process:", err);
      setError(err.message || 'Error al subir o procesar el archivo.');
    }
  };

  const handleLocalUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setLocalFileName(null);
    setOnusFromLocalFile([]);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const jsonData = processExcel(arrayBuffer);
      setOnusFromLocalFile(jsonData);
      setLocalFileName(file.name);
    } catch (err: any) {
      console.error("Error processing local file:", err);
      setError(err.message || 'Error al procesar el archivo local.');
    }
  };

  const clearLocalFile = () => {
    setLocalFileName(null);
    setOnusFromLocalFile([]);
    if(localFileInputRef.current) {
        localFileInputRef.current.value = "";
    }
  }


  const handleConfirmRetire = () => {
    if (onuToManage) {
        const removedDate = new Date().toISOString();
        const docRef = doc(firestore, 'onus', onuToManage.id);
        setDocumentNonBlocking(docRef, {
          status: 'removed',
          removedDate: removedDate,
          history: [...(onuToManage.history || []), { action: 'removed', date: removedDate }]
        }, { merge: true });
    }
    setIsConfirmRetireOpen(false);
    setOnuToManage(null);
  };
  
  const handleConfirmRestore = () => {
    if (onuToManage) {
      const restoredDate = new Date().toISOString();
      const docRef = doc(firestore, 'onus', onuToManage.id);
      updateDocumentNonBlocking(docRef, {
        status: 'active',
        removedDate: null,
        history: [...(onuToManage.history || []), { action: 'restored', date: restoredDate }]
      });
    }
    setIsConfirmRestoreOpen(false);
    setOnuToManage(null);
  };

  const handleAddOnu = () => {
      if(!newOnuId || !newOnuShelf) {
          alert("Por favor completa ambos campos.");
          return;
      }
      const addedDate = new Date().toISOString();
      const newOnu: OnuData = {
          id: newOnuId,
          'ONU ID': newOnuId,
          'Shelf': newOnuShelf,
          addedDate: addedDate,
          history: [{ action: 'created', date: addedDate, source: 'manual'}],
          status: 'active',
      };
      const docRef = doc(firestore, 'onus', newOnu.id);
      setDocumentNonBlocking(docRef, newOnu, { merge: true });
      setNewOnuId('');
      setNewOnuShelf('');
      setIsAddOnuOpen(false);
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
    if (!searchTerm) return mergedOnus;
    return mergedOnus.filter((row) => 
        row['ONU ID']?.toString().toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, mergedOnus]);
  
  const shelves = useMemo(() => {
    const shelfMap: Record<string, OnuData[]> = {};
    if (activeView === 'activas') {
        mergedOnus.forEach(onu => {
            const shelf = onu.Shelf || 'Sin Estante';
            if (!shelfMap[shelf]) {
                shelfMap[shelf] = [];
            }
            shelfMap[shelf].push(onu);
        });
    }
    return Object.entries(shelfMap).sort(([shelfA], [shelfB]) => shelfA.localeCompare(shelfB, undefined, { numeric: true, sensitivity: 'base' }));
  }, [mergedOnus, activeView]);

  
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
      case 'created': return <PackagePlus className="h-4 w-4 text-green-500" />;
      case 'added': return <FileDown className="h-4 w-4 text-blue-500" />;
      case 'removed': return <Trash2 className="h-4 w-4 text-red-500" />;
      case 'restored': return <Repeat className="h-4 w-4 text-yellow-500" />;
      default: return <History className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getHistoryMessage = (entry: OnuHistoryEntry) => {
    switch (entry.action) {
      case 'created': return `Creada manualmente`;
      case 'added': return `Agregada desde archivo`;
      case 'removed': return `Retirada del inventario`;
      case 'restored': return `Devuelta al inventario`;
      default: return `Acción desconocida`;
    }
  }

  const renderOnuCard = (row: OnuData, index: number) => {
    const isRetired = row.status === 'removed';
    const isExactMatch = searchTerm.length > 0 && row['ONU ID'].toLowerCase() === searchTerm.toLowerCase();
    const onuId = row['ONU ID'];
    const idPrefix = onuId.slice(0, -6);
    const idSuffix = onuId.slice(-6);
    const isInSearchList = searchList.includes(row.id);
  
    return (
      <Card key={`${row.id}-${index}`} className={`group flex flex-col justify-between transition-all duration-300 ${isExactMatch ? 'border-primary shadow-lg scale-105' : ''} ${isInSearchList ? 'border-blue-500' : ''}`}>
        <div>
          <CardHeader className="pb-2">
             <div className="flex justify-between items-start">
                <CardTitle className="flex items-start text-base text-primary break-all font-mono">
                <Tag className="mr-2 h-4 w-4 flex-shrink-0 mt-1"/>
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
                </CardTitle>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                            <History className="h-4 w-4" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Historial de la ONU</DialogTitle>
                            <DialogDescription className="font-mono break-all pt-2">{row["ONU ID"]}</DialogDescription>
                        </DialogHeader>
                        <div className="max-h-80 overflow-y-auto pr-4">
                            <ul className="space-y-4 mt-4">
                                {[...(row.history || [])].reverse().map((entry, idx) => (
                                    <li key={idx} className="flex items-start gap-3">
                                        <div className="mt-1">{getHistoryIcon(entry.action)}</div>
                                        <div>
                                            <p className="font-medium text-sm">{getHistoryMessage(entry)}</p>
                                            <p className="text-xs text-muted-foreground">{formatDate(entry.date)}</p>
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
              <span className={`font-bold text-foreground ${isExactMatch ? 'text-lg' : ''}`}>{row.Shelf}</span>
            </p>
            <p className="flex items-center font-medium">
              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground mr-2">Agregada:</span> 
              <span className="text-foreground text-xs">{formatDate(row.addedDate)}</span>
            </p>
            {isRetired && row.removedDate && (
               <p className="flex items-center font-medium text-destructive/80">
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span className="mr-2">Retirada:</span> 
                  <span className="text-xs">{formatDate(row.removedDate)}</span>
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
                if (profile?.isAdmin) {
                  setOnuToManage(row);
                  setIsConfirmRestoreOpen(true);
                }
              }}
              disabled={!profile?.isAdmin}
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
                if (profile?.isAdmin) {
                  setOnuToManage(row);
                  setIsConfirmRetireOpen(true);
                }
              }}
              disabled={!profile?.isAdmin}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Retirar
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  }

  const renderSearchResults = () => (
    <div className="space-y-4">
        {filteredResults && filteredResults.length > 0 ? (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
               {filteredResults.map((onu, index) => renderOnuCard(onu, index))}
           </div>
        ) : (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">
                  No se encontraron resultados para <strong className="text-foreground">"{searchTerm}"</strong>.
                </p>
            </div>
        )}
    </div>
  );

  const renderShelfAccordion = () => (
    <div className="space-y-4">
        {shelves.length > 0 ? (
            <Accordion type="single" collapsible className="w-full" defaultValue={shelves.length > 0 ? shelves[0][0] : undefined}>
                {shelves.map(([shelf, onus]) => (
                    <AccordionItem value={shelf} key={shelf}>
                        <AccordionTrigger>
                            <div className="flex items-center gap-3">
                                <Server className="h-5 w-5 text-primary" />
                                <span className="font-medium">{shelf}</span>
                                <Badge variant="secondary">{onus.length} ONUs</Badge>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                                {onus.map((onu, index) => renderOnuCard(onu, index))}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        ) : (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">
                  No hay ONUs activas para mostrar. {profile?.isAdmin ? "Puedes cargar un archivo para empezar." : "Espera a que un administrador cargue los datos."}
                </p>
            </div>
        )}
    </div>
  );

  const renderRemovedList = () => (
      <div className="space-y-4">
        {filteredResults && filteredResults.length > 0 ? (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
               {filteredResults.map((onu, index) => renderOnuCard(onu, index))}
           </div>
        ) : (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground">
                  {searchTerm 
                    ? <>No se encontraron resultados para <strong className="text-foreground">"{searchTerm}"</strong>.</>
                    : "No hay ONUs retiradas."
                  }
                </p>
            </div>
        )}
      </div>
  );
  
  const showUploadCard = !fileInfo && profile?.isAdmin && !localFileName;

  if (isLoadingOnus && !fileInfo && !localFileName) {
    return (
        <section className="w-full max-w-7xl mx-auto flex flex-col gap-8 justify-center items-center min-h-[calc(100vh-200px)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando datos del inventario...</p>
        </section>
    );
  }

  return (
    <section className="w-full max-w-7xl mx-auto flex flex-col gap-8">
      {showUploadCard ? (
        <Card className="text-center max-w-xl mx-auto">
          <CardHeader>
            <div className="mx-auto bg-secondary p-3 rounded-full w-fit">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="font-headline mt-4">Importar Hoja de Cálculo</CardTitle>
            <CardDescription>
              Sube tu archivo de Excel a la nube para que sea usado por todos o carga uno local para una sesión temporal.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
                {error && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                <div className="flex flex-col items-center gap-4">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleCloudUpload}
                        className="hidden"
                        accept=".xlsx, .xls, .csv"
                    />
                    <Button onClick={() => fileInputRef.current?.click()}>
                        <Upload className="mr-2 h-4 w-4" />
                        Subir a la Nube
                    </Button>
                    <input
                        type="file"
                        ref={localFileInputRef}
                        onChange={handleLocalUpload}
                        className="hidden"
                        accept=".xlsx, .xls, .csv"
                    />
                     <Button variant="outline" onClick={() => localFileInputRef.current?.click()}>
                        <File className="mr-2 h-4 w-4" />
                        Cargar Archivo Local
                    </Button>
                </div>
          </CardContent>
        </Card>
      ) : (
        <>
         <div className="space-y-4">
            <div className="flex justify-between items-start gap-4 flex-wrap">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-headline font-semibold">
                            {activeView === 'activas' ? `Inventario de ONUs Activas (${mergedOnus.length})` : `ONUs Retiradas (${mergedOnus.length})`}
                        </h2>
                    </div>
                    <p className="text-muted-foreground text-sm mt-1">
                        {activeView === 'activas' ? 'Visualiza y gestiona las ONUs disponibles en los estantes.' : 'Consulta el historial de ONUs que han sido retiradas.'}
                    </p>
                </div>
                {profile?.isAdmin && (
                  <div className="flex gap-2">
                      <Dialog open={isAddOnuOpen} onOpenChange={setIsAddOnuOpen}>
                          <DialogTrigger asChild>
                              <Button variant="outline">
                                  <PlusCircle className="mr-2 h-4 w-4" />
                                  Agregar ONU
                              </Button>
                          </DialogTrigger>
                          <DialogContent>
                              <DialogHeader>
                                  <DialogTitle>Agregar Nueva ONU/STB</DialogTitle>
                                  <DialogDescription>
                                    Esta acción la agregará a Firestore, pero para que aparezca en la lista principal, debes actualizar y volver a subir el archivo de Excel.
                                  </DialogDescription>
                              </DialogHeader>
                              <div className="grid gap-4 py-4">
                                  <div className="grid grid-cols-4 items-center gap-4">
                                      <Label htmlFor="new-onu-id" className="text-right">ID de ONU</Label>
                                      <Input id="new-onu-id" value={newOnuId} onChange={(e) => setNewOnuId(e.target.value)} className="col-span-3" placeholder="Ej: 2430011054007532" />
                                  </div>
                                  <div className="grid grid-cols-4 items-center gap-4">
                                      <Label htmlFor="new-onu-shelf" className="text-right">Estante</Label>
                                      <Select value={newOnuShelf} onValueChange={setNewOnuShelf}>
                                        <SelectTrigger className="col-span-3">
                                          <SelectValue placeholder="Selecciona un estante" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {allShelves.map(shelf => (
                                            <SelectItem key={shelf} value={shelf}>{shelf}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                  </div>
                              </div>
                              <DialogFooter>
                                  <DialogClose asChild>
                                    <Button variant="outline">Cancelar</Button>
                                  </DialogClose>
                                  <Button onClick={handleAddOnu}>Guardar ONU</Button>
                              </DialogFooter>
                          </DialogContent>
                      </Dialog>
                       <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleCloudUpload}
                        className="hidden"
                        accept=".xlsx, .xls, .csv"
                    />
                    <Button onClick={() => fileInputRef.current?.click()}>
                        <Upload className="mr-2 h-4 w-4" />
                        Subir a la Nube
                    </Button>
                  </div>
                )}
            </div>

             {localFileName ? (
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 text-sm bg-yellow-100 border border-yellow-300 text-yellow-800 p-2 rounded-md">
                    <p>Archivo local en uso: <span className="font-medium">{localFileName}</span></p>
                    <Button variant="ghost" size="sm" className="text-yellow-800 hover:bg-yellow-200" onClick={clearLocalFile}>
                        <XCircle className="mr-2 h-4 w-4" />
                        Limpiar archivo local
                    </Button>
                </div>
            ) : fileInfo?.fileName && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 text-sm">
                    <p className="text-muted-foreground">Archivo en la nube: <span className="font-medium text-foreground">{fileInfo.fileName}</span></p>
                </div>
            )}
         </div>

         <Card>
            <CardHeader>
                <CardTitle>Búsqueda Rápida</CardTitle>
                <CardDescription>Busca por ID en la vista actual.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-xl">
                <Label htmlFor="search-term">ID de la ONU</Label>
                <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    id="search-term"
                    type="text"
                    placeholder={`Buscar entre ${mergedOnus?.length || 0} ONUs...`}
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
            {isPending || isLoadingOnus ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                    {[...Array(8)].map((_, i) => ( 
                      <Skeleton key={i} className="h-48 w-full" />
                    ))}
                </div>
            ) : (
              <>
                {searchTerm ? (
                  renderSearchResults()
                ) : (
                  activeView === 'activas' ? renderShelfAccordion() : renderRemovedList()
                )}
              </>
            )}
        </div>
        </>
      )}

      {/* Confirmation Dialogs */}
      <AlertDialog open={isConfirmRetireOpen} onOpenChange={setIsConfirmRetireOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción marcará la ONU <strong className="break-all">{onuToManage?.['ONU ID']}</strong> como retirada en la base de datos de historial. No se eliminará del archivo de Excel.
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
              Esta acción devolverá la ONU <strong className="break-all">{onuToManage?.['ONU ID']}</strong> a la lista de activas.
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

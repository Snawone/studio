
'use client';

import { useState, useMemo, useEffect } from 'react';
import { collection, doc } from 'firebase/firestore';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger, SidebarFooter } from '@/components/ui/sidebar';
import { OnuFinder } from '@/components/onu-finder';
import { Icons } from '@/components/icons';
import { Boxes, Trash2, Settings, History, SearchCheck, Loader2, LogOut } from 'lucide-react';
import { OptionsPage } from '@/components/options-page';
import { HistoryPage } from '@/components/history-page';
import { SearchListPage } from '@/components/search-list-page';
import { useCollection, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useAuthContext } from '@/firebase/auth/auth-provider';
import { type OnuData, type UserProfile, type FileInfo, type OnuFromSheet } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { getStorage, ref, getBytes } from "firebase/storage";
import * as XLSX from "xlsx";

export default function AppPage() {
  const [activeView, setActiveView] = useState<'activas' | 'retiradas' | 'opciones' | 'historial' | 'en-busqueda'>('activas');
  
  const { user, profile, isAuthLoading, logout } = useAuthContext();
  const firestore = useFirestore();
  const storage = getStorage();

  // Local file state
  const [onusFromLocalFile, setOnusFromLocalFile] = useState<OnuFromSheet[]>([]);
  const [localFileName, setLocalFileName] = useState<string | null>(null);

  // Cloud file state
  const [onusFromCloudSheet, setOnusFromCloudSheet] = useState<OnuFromSheet[]>([]);

  const onusCollectionRef = useMemoFirebase(() => collection(firestore, 'onus'), [firestore]);
  const { data: allOnusFromFirestore, isLoading: isOnusLoading } = useCollection<OnuData>(onusCollectionRef);

  const fileInfoDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'fileInfo'), [firestore]);
  const { data: fileInfo, isLoading: isFileInfoLoading } = useDoc<FileInfo>(fileInfoDocRef);

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
    const fetchAndProcessFile = async () => {
      if (localFileName) {
        setOnusFromCloudSheet([]); // Ensure cloud sheet data is cleared if local is used
        return;
      }
      if (!fileInfo || !fileInfo.fileUrl) {
        setOnusFromCloudSheet([]);
        return;
      }

      try {
        const storageRef = ref(storage, fileInfo.fileUrl);
        const arrayBuffer = await getBytes(storageRef);
        const jsonData = processExcel(arrayBuffer, fileInfo.sheetName);
        setOnusFromCloudSheet(jsonData);
      } catch (err: any) {
        console.error("Error fetching or processing cloud file:", err);
        setOnusFromCloudSheet([]);
      }
    };
    
    fetchAndProcessFile();
  }, [fileInfo, storage, localFileName]);


  const { mergedOnus, searchListOnus, allShelves } = useMemo(() => {
    const onusToProcess = allOnusFromFirestore || [];
    const sourceSheet = localFileName ? onusFromLocalFile : onusFromCloudSheet;

    let combined: OnuData[];

    if (sourceSheet.length > 0) {
        const firestoreMap = new Map(onusToProcess.map(onu => [onu.id, onu]));
        combined = sourceSheet.map(sheetOnu => {
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
    } else {
        combined = onusToProcess;
    }
    
    const active = combined.filter(onu => onu.status === 'active');
    const shelves = Array.from(new Set(active.map(onu => onu.Shelf))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    const search = profile ? combined.filter(onu => profile.searchList.includes(onu.id)) : [];
    
    return { mergedOnus: combined, searchListOnus: search, allShelves: shelves };
  }, [allOnusFromFirestore, onusFromCloudSheet, onusFromLocalFile, localFileName, profile]);


  const activeOnus = useMemo(() => mergedOnus.filter(onu => onu.status === 'active'), [mergedOnus]);
  const removedOnus = useMemo(() => mergedOnus.filter(onu => onu.status === 'removed'), [mergedOnus]);

  if (isAuthLoading || !user || !profile || isFileInfoLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Cargando datos...</p>
      </div>
    );
  }


  const renderActiveView = () => {
    switch (activeView) {
      case 'activas':
        return <OnuFinder 
                  activeView="activas" 
                  onusFromFirestore={activeOnus} 
                  searchList={profile.searchList}
                  allShelves={allShelves}
                  userId={user.uid}
                  fileInfo={fileInfo}
                  isLoadingOnus={isOnusLoading}
                  onusFromLocalFile={onusFromLocalFile}
                  setOnusFromLocalFile={setOnusFromLocalFile}
                  localFileName={localFileName}
                  setLocalFileName={setLocalFileName}
                  processExcel={processExcel}
                />;
      case 'retiradas':
        return <OnuFinder 
                  activeView="retiradas" 
                  onusFromFirestore={removedOnus} 
                  searchList={profile.searchList}
                  allShelves={allShelves}
                  userId={user.uid}
                  fileInfo={fileInfo}
                  isLoadingOnus={isOnusLoading}
                  onusFromLocalFile={onusFromLocalFile}
                  setOnusFromLocalFile={setOnusFromLocalFile}
                  localFileName={localFileName}
                  setLocalFileName={setLocalFileName}
                  processExcel={processExcel}
                />;
      case 'opciones':
        return <OptionsPage />;
      case 'historial':
        return <HistoryPage allOnus={mergedOnus} />;
      case 'en-busqueda':
        return <SearchListPage 
                  searchListOnus={searchListOnus}
                  searchListIds={profile.searchList}
                  userId={user.uid}
                />;
      default:
        return <OnuFinder 
                  activeView="activas" 
                  onusFromFirestore={activeOnus} 
                  searchList={profile.searchList}
                  allShelves={allShelves}
                  userId={user.uid}
                  fileInfo={fileInfo}
                  isLoadingOnus={isOnusLoading}
                  onusFromLocalFile={onusFromLocalFile}
                  setOnusFromLocalFile={setOnusFromLocalFile}
                  localFileName={localFileName}
                  setLocalFileName={setLocalFileName}
                  processExcel={processExcel}
                />;
    }
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
           <div className="flex items-center gap-3 p-2">
            <Icons.logo className="h-7 w-7 text-primary" />
            <h1 className="font-headline text-xl font-bold tracking-tight text-foreground">
              ONUs & SBTs
            </h1>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setActiveView('activas')} isActive={activeView === 'activas'} tooltip='Activas'>
                <Boxes />
                Activas
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setActiveView('retiradas')} isActive={activeView === 'retiradas'} tooltip='Retiradas'>
                <Trash2 />
                Retiradas
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setActiveView('en-busqueda')} isActive={activeView === 'en-busqueda'} tooltip='En Búsqueda'>
                <SearchCheck />
                En Búsqueda
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setActiveView('historial')} isActive={activeView === 'historial'} tooltip='Historial'>
                <History />
                Historial
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActiveView('opciones')} isActive={activeView === 'opciones'} tooltip='Opciones'>
                    <Settings />
                    Opciones
                </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <Button variant="ghost" className="w-full justify-start gap-2" onClick={logout}>
                  <LogOut />
                  <span className="group-data-[collapsible=icon]:hidden">Cerrar Sesión</span>
              </Button>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="border-b md:hidden">
          <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-3">
               <SidebarTrigger>
                  <Icons.logo className="h-7 w-7 text-primary" />
               </SidebarTrigger>
              <h1 className="font-headline text-xl font-bold tracking-tight text-foreground">
                ONUs & SBTs
              </h1>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8 md:px-6 md:py-12">
            {renderActiveView()}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

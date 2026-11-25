; Refresh shell icon associations after updating the EXE and shortcuts; never delete caches or restart Explorer.
!macro customInstall
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

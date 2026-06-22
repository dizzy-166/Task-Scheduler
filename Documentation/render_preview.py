import sys, os
from pptx import Presentation
from spire.presentation import Presentation as SP
SRC = r"C:\Users\denis\OneDrive\Desktop\Шеронов Денис Сергеевич.pptx"
targets = [int(x) for x in sys.argv[1:]] or [1,8,9,13]
os.makedirs(r"C:\Temp\pv", exist_ok=True)
for tn in targets:
    p = Presentation(SRC); xs = p.slides._sldIdLst
    for i, sid in enumerate(list(xs)):
        if i != tn-1: xs.remove(sid)
    tmp = rf"C:\Temp\pv\o{tn}.pptx"; p.save(tmp)
    sp = SP(); sp.LoadFromFile(tmp); sp.Slides[0].SaveAsImage().Save(rf"C:\Temp\pv\n{tn:02d}.png"); sp.Dispose()
    print("rendered", tn)

#!/usr/bin/env python3
"""His artboard supplies the questions; the answers he drew come from the artboard,
   the rest from the approved Q&A copy, matched on the question."""
import json,re,unicodedata,sys
HERE='/home/user/highway19media/tools/qa/'
cards=json.load(open(HERE+'cards.json',encoding='utf-8'))
copy=json.load(open(HERE+'copy.json',encoding='utf-8'))
pool=[(q,a) for c in copy for q,a in c['faqs']]
def norm(s):
    s=unicodedata.normalize('NFKD',s).replace('’',"'").replace('‘',"'")
    return re.sub(r'[^a-z0-9 ]','',s.lower())
def tk(s): return set(norm(s).split())
miss=[]
for k,sec in cards.items():
    for c in sec['cards']:
        if c['open']:
            c['ans']=[' '.join(c['a'])]; c['src']='artboard'; continue
        t=tk(c['q']); best=None; bs=0
        for q,a in pool:
            o=len(t&tk(q))/max(1,len(t|tk(q)))
            if o>bs: bs,best=o,(q,a)
        if bs>=0.6: c['ans']=best[1]; c['src']='copy'
        else: c['ans']=None; c['src']=None; miss.append((k,c['q']))
json.dump(cards,open(HERE+'cards.json','w',encoding='utf-8'),indent=1,ensure_ascii=False)
print('cards',sum(len(s['cards']) for s in cards.values()),'| no answer:',len(miss))
for m in miss: print('   ',m[0],'|',m[1])

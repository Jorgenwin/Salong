import json,re
acc=json.load(open('wave1_merged.json'))
SEG={'nettverk':'ovrige'}
def slug(s): return re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')[:48]
docs={}
TODAY='2026-10-06'
for a in acc:
    es=a.get('event_signal') or {}
    srcs=[{'url':s['url'],'title':s.get('title',''),'checked':s.get('checked',TODAY)} for s in a['sources']]
    first=srcs[0]['url']
    sigs=[]
    types=es.get('types') or []
    att=es.get('typical_attendance')
    cap=att if isinstance(att,int) else None
    conf=es.get('confidence')
    if es.get('documented') and conf in('high','medium'):
        level='Dokumentert' if conf=='high' else 'Indikasjon'
        for nd in es.get('next_dates') or []:
            if not nd.get('date'): continue
            sigs.append({'event_name':nd.get('title') or (es.get('summary') or '')[:100],'event_type':types[0] if types else 'arrangement','level':level,'date':nd['date'],'venue':nd.get('venue') or '','recurrence':es.get('frequency') or '',
              'source_url':nd.get('url') or first,'source_date':TODAY,'title':nd.get('title') or '','type':types[0] if types else 'arrangement','capacity':cap,'confidence':conf,'source':nd.get('url') or first,'sourceDate':TODAY})
        if not sigs:
            sigs.append({'event_name':(es.get('summary') or 'Arrangementsaktivitet')[:140],'event_type':types[0] if types else 'arrangement','level':level,'date':'','venue':(es.get('venues') or [''])[0],'recurrence':es.get('frequency') or '',
              'source_url':first,'source_date':TODAY,'title':'','type':types[0] if types else 'arrangement','capacity':cap,'confidence':conf,'source':first,'sourceDate':TODAY})
    d={'name':a['name'],'website':a['website'],'domain':a['domain'],'orgnr':'','segId':SEG.get(a['segment'],a['segment']),'place':a.get('place') or '','geo':a.get('geo') or '',
       'size':a.get('size') or '','why':a.get('why') or '','about':a.get('about') or '','src':'research','srcUrl':first,'checkedAt':TODAY,'wave':'W1','createdFrom':'research',
       'contactRoles':a.get('contact_roles') or [],
       'prov':{'type':'research','method':'Åpen web-research (Exa/Firecrawl), kilder lest 2026-10-06','researchedAt':TODAY,'sources':srcs},
       'evsum':{'documented':bool(es.get('documented')),'summary':es.get('summary') or '','types':types,'frequency':es.get('frequency'),'attendance':att,'attendanceSource':es.get('attendance_source'),'venues':es.get('venues') or [],'months':es.get('months') or [],'open':es.get('open_closed') or 'ukjent','confidence':conf or 'low'},
       'roomHint':a.get('room_hint') or '',
       'hist':[{'at':TODAY+'T12:00:00.000Z','by':'Research','t':'Lagt til i målmarkedet (research, bølge 1)'}]}
    if sigs: d['enr']={'event_signals':sigs,'enriched_at':TODAY+'T12:00:00.000Z','source':'research','result_version':1}
    k='w1-'+slug(a['domain'] or a['name'])
    assert k not in docs,k
    docs[k]=d
json.dump(docs,open('wave1_docs.json','w'),ensure_ascii=False,indent=0)
print(len(docs), sum(1 for d in docs.values() if 'enr' in d), sum(len(d['enr']['event_signals']) for d in docs.values() if 'enr' in d))

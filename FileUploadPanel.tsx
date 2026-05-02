import { type DragEvent, useCallback, useRef, useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';

type Lang = 'bg' | 'en' | 'ar';

type FileUploadPanelProps = {
  senderEmail?: string;
  lang: Lang;
};

export default function FileUploadPanel({ senderEmail, lang }: FileUploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle');
  const [note, setNote] = useState<string | null>(null);

  const copy =
    lang === 'bg'
      ? {
          title: 'Прикачени файлове',
          hint: 'Ако са зададени S3_* променливите, файловете се качват директно в bucket през подписан URL. Иначе се записват само метаданни.',
          choose: 'Избор на файлове',
          emailHint: 'За връзка ще ползваме имейла от формата:',
          none: 'Няма избрани файлове.',
          upload: 'Качи',
          sending: 'Качване…',
          okUpload: 'Готово — файловете са в облака; записът е логнат.',
          okMeta: 'Метаданните са записани (облакът не е конфигуриран или качването не се ползва).',
          err: 'Грешка при заявка към API.',
          errSign: 'Неуспешно подписване за качване.',
          errPut: 'Качването към хранилището не успя (провери CORS на bucket за origin на приложението).',
          corsHint:
            'За R2/S3 задай CORS правило за PUT от твоя localhost / домейн. Виж README в Cloudflare R2 → Settings → CORS.',
        }
      : lang === 'ar'
        ? {
            title: 'مرفقات',
            hint: 'عند ضبط متغيرات S3_* تُرفَع الملفات عبر PUT موقّع. وإلا يُسجَّل الوصف فقط.',
            choose: 'اختر ملفات',
            emailHint: 'البريد للتواصل من النموذج:',
            none: 'لم يُحدَّد أي ملف.',
            upload: 'رفع',
            sending: 'جاري الرفع…',
            okUpload: 'تم — الملفات في التخزين السحابي ومُسجَّلة.',
            okMeta: 'تُسجَّل البيانات الوصفية فقط (التخزين غير مهيأ أو تُخطى عملية الرفع).',
            err: 'فشل طلب API.',
            errSign: 'تعذّر الحصول على توقيع الرفع.',
            errPut: 'فشل PUT للتخزين (تحقق من CORS للـ bucket نحو أصل التطبيق).',
            corsHint:
              'اضبط CORS في R2/S3 للسماح بـ PUT من localhost أو أصل الإنتاج (راجع Cloudflare R2 → CORS).',
          }
        : {
            title: 'Attachments',
            hint: 'When S3_* env vars are set, files upload via presigned PUT. Otherwise only metadata is logged.',
            choose: 'Choose files',
            emailHint: 'Contact email from the form:',
            none: 'No files selected.',
            upload: 'Upload',
            sending: 'Uploading…',
            okUpload: 'Done — files are in object storage and logged.',
            okMeta: 'Metadata logged (storage not configured or upload skipped).',
            err: 'API request failed.',
            errSign: 'Could not get upload signature.',
            errPut: 'PUT to storage failed (check bucket CORS for your app origin).',
            corsHint:
              'Configure R2/S3 CORS to allow PUT from your localhost / production origin (see Cloudflare R2 → CORS).',
          };

  const pushFiles = useCallback((list: FileList | File[]) => {
    const next = Array.from(list).slice(0, 12);
    setPendingFiles(next);
    setNote(null);
    setStatus('idle');
  }, []);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files?.length) pushFiles(e.dataTransfer.files);
  };

  const submitAll = async () => {
    if (pendingFiles.length === 0) return;
    setStatus('sending');
    setNote(null);

    const metaPayload = (files: File[]) =>
      files.map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type || 'application/octet-stream',
      }));

    let useObjectStorage = false;
    const uploads: { key: string; name: string; size: number; publicUrl?: string }[] = [];

    try {
    const signFirst = await fetch('/api/upload-sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: pendingFiles[0].name,
        contentType: pendingFiles[0].type || 'application/octet-stream',
        size: pendingFiles[0].size,
      }),
    });
    const probe = (await signFirst.json()) as { uploadUrl?: string; key?: string; publicUrl?: string; error?: string };

    const storageUnavailable =
      signFirst.status === 503 || String(probe.error || '').toLowerCase().includes('not configured');

    if (!signFirst.ok && !storageUnavailable) {
      setStatus('err');
      setNote(probe.error || copy.errSign);
      return;
    }

    if (signFirst.ok && probe.uploadUrl && probe.key) {
      useObjectStorage = true;
      const put0 = await fetch(probe.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': pendingFiles[0].type || 'application/octet-stream' },
        body: pendingFiles[0],
      });
      if (!put0.ok) {
        setStatus('err');
        setNote(`${copy.errPut}\n${copy.corsHint}`);
        return;
      }
      uploads.push({
        key: probe.key,
        name: pendingFiles[0].name,
        size: pendingFiles[0].size,
        publicUrl: probe.publicUrl,
      });

      for (let i = 1; i < pendingFiles.length; i++) {
        const file = pendingFiles[i];
        const signRes = await fetch('/api/upload-sign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || 'application/octet-stream',
            size: file.size,
          }),
        });
        const data = (await signRes.json()) as {
          uploadUrl?: string;
          key?: string;
          publicUrl?: string;
          error?: string;
        };
        if (!signRes.ok || !data.uploadUrl || !data.key) {
          setStatus('err');
          setNote(data.error || copy.errSign);
          return;
        }
        const put = await fetch(data.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!put.ok) {
          setStatus('err');
          setNote(`${copy.errPut}\n${copy.corsHint}`);
          return;
        }
        uploads.push({
          key: data.key,
          name: file.name,
          size: file.size,
          publicUrl: data.publicUrl,
        });
      }
    }

      const metaRes = await fetch('/api/file-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: useObjectStorage ? [] : metaPayload(pendingFiles),
          uploads: useObjectStorage ? uploads : undefined,
          senderEmail: senderEmail?.trim() || undefined,
        }),
      });
      const data = (await metaRes.json()) as { ok?: boolean; error?: string };
      if (!metaRes.ok || !data.ok) {
        setStatus('err');
        setNote(data.error || copy.err);
        return;
      }
      setStatus('ok');
      setNote(useObjectStorage ? copy.okUpload : copy.okMeta);
    } catch {
      setStatus('err');
      setNote(copy.err);
    }
  };

  return (
    <div
      style={{
        marginTop: 16,
        padding: 14,
        border: `1px solid ${drag ? '#22c55e' : '#1e293b'}`,
        borderRadius: 12,
        background: drag ? 'rgba(34,197,94,0.06)' : '#0f172a',
        transition: 'border-color 0.15s ease, background 0.15s ease',
      }}
      onDragEnter={(e: DragEvent) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragOver={(e: DragEvent) => e.preventDefault()}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <FileUp size={20} color="#22c55e" />
        <strong style={{ fontSize: '1rem' }}>{copy.title}</strong>
      </div>
      <p style={{ margin: '0 0 10px', color: '#94a3b8', fontSize: 13, lineHeight: 1.45 }}>{copy.hint}</p>
      {senderEmail?.trim() ? (
        <p style={{ margin: '0 0 10px', color: '#64748b', fontSize: 12 }}>
          {copy.emailHint} <span style={{ color: '#cbd5e1' }}>{senderEmail.trim()}</span>
        </p>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files?.length) pushFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn-mini" onClick={() => inputRef.current?.click()}>
          {copy.choose}
        </button>
        <button
          type="button"
          className="btn-mini"
          disabled={pendingFiles.length === 0 || status === 'sending'}
          onClick={() => void submitAll()}
        >
          {status === 'sending' ? (
            <>
              <Loader2 size={14} className="spin" /> {copy.sending}
            </>
          ) : (
            copy.upload
          )}
        </button>
      </div>

      <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: '#cbd5e1', fontSize: 13 }}>
        {pendingFiles.length === 0 ? (
          <li style={{ color: '#64748b', listStyle: 'none', marginLeft: -18 }}>{copy.none}</li>
        ) : (
          pendingFiles.map((f, idx) => (
            <li key={`${f.name}-${f.size}-${idx}`}>
              {f.name}{' '}
              <span style={{ color: '#64748b' }}>
                ({(f.size / 1024).toFixed(1)} KB{f.type ? ` · ${f.type}` : ''})
              </span>
            </li>
          ))
        )}
      </ul>

      {note && (
        <p style={{ margin: '10px 0 0', color: status === 'ok' ? '#86efac' : '#f87171', fontSize: 13, whiteSpace: 'pre-wrap' }}>
          {note}
        </p>
      )}
    </div>
  );
}

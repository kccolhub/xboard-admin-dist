// Readable source for the certificate generator included in the admin bundle.
export async function generateCertificateIntoForm(form, certPath, generate) {
  const fields = ['cert_mode', 'domain', 'cert_content', 'key_content'].map(name => `${certPath}.${name}`);
  const before = fields.map(name => form.getValues(name));
  const response = await generate(String(before[1] || '').trim());
  const data = response?.data;
  if (!data?.cert_content?.includes('-----BEGIN CERTIFICATE-----') || !data?.key_content?.includes('PRIVATE KEY-----')) {
    throw new Error('Invalid certificate response');
  }
  // Do not overwrite edits or fill a different mode while the request is pending.
  if (before[0] !== 'content' || fields.some((name, i) => form.getValues(name) !== before[i])) return false;
  const options = { shouldDirty: true, shouldValidate: true };
  form.setValue(fields[2], data.cert_content, options);
  form.setValue(fields[3], data.key_content, options);
  return true;
}

const certificateGeneratorText = {
  'zh-CN': {
    generate: '自动生成', generating: '生成中…',
    title: '按证书域名生成自签名证书并填入证书和私钥',
    success: '证书和私钥已填入，请保存并提交节点配置。',
    changed: '表单已变更，未覆盖当前内容，请重新生成。',
    failed: '证书生成失败，请检查证书域名后重试。',
  },
  'en-US': {
    generate: 'Auto generate', generating: 'Generating…',
    title: 'Generate a self-signed certificate and private key for this name',
    success: 'Certificate and private key filled. Save and submit the node to apply.',
    changed: 'The form changed. Current values were kept; please generate again.',
    failed: 'Certificate generation failed. Check the name and try again.',
  },
  'ru-RU': {
    generate: 'Сгенерировать', generating: 'Генерация…',
    title: 'Создать самоподписанный сертификат и закрытый ключ для этого имени',
    success: 'Сертификат и ключ заполнены. Сохраните настройки узла.',
    changed: 'Форма изменена. Значения сохранены; повторите генерацию.',
    failed: 'Не удалось создать сертификат. Проверьте имя и повторите попытку.',
  },
};

export function CertificateGeneratorButton({ form, certPath, ui }) {
  const [busy, setBusy] = ui.React.useState(false);
  const { i18n } = ui.useTranslation('server');
  const text = certificateGeneratorText[i18n.language] || certificateGeneratorText['en-US'];
  const domain = form.watch(`${certPath}.domain`);
  return ui.jsx(ui.Button, {
    type: 'button', variant: 'outline', size: 'sm',
    className: 'shrink-0 font-mono text-xs',
    style: { alignSelf: 'center' },
    disabled: busy || !String(domain || '').trim(),
    title: text.title,
    onClick: async () => {
      setBusy(true);
      try {
        const filled = await generateCertificateIntoForm(form, certPath,
          domain => ui.post(ui.adminPath + '/server/manage/generateCertificate', { domain }));
        if (filled) ui.toast.success(text.success);
        else ui.toast.error(text.changed);
      } catch {
        // The shared HTTP client displays server validation errors as well.
        ui.toast.error(text.failed);
      } finally {
        setBusy(false);
      }
    },
    children: busy ? text.generating : text.generate,
  });
}

import AdmZip from 'adm-zip';

try {
  const zip = new AdmZip();
  zip.addLocalFolder('./dist');
  zip.writeZip('./dist.zip');
  console.log('Successfully zipped dist to dist.zip!');
} catch (e) {
  console.error('Error zipping:', e);
}

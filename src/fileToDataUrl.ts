export default function fileToDataUrl(file: File): Promise<string | ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        console.log('reading file');
        reader.readAsDataURL(file);
        reader.onload = () => {
            if (reader.result === null) {
                console.error('null reader result');
                reject();
                return;
            }
            if ((typeof reader.result) === typeof ArrayBuffer) {
                console.error('array buffer result');
                reject();
                return;
            }
            let r: string | ArrayBuffer = reader.result;
            resolve(r);
        };
        reader.onerror = error => reject(error);
    });
}
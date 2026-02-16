import AuthContext from "./AuthContext";
export default () => {
    const auth = AuthContext.useAuth();
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if(!file){
            return;
        }

        const base64_encoded_data = 
            await new Promise<string>(resolve => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const dataURL = e.target?.result as string;
                    const base64String = dataURL.replace(/^data:.+;base64,/, '');
                    resolve(base64String);
                };
                reader.readAsDataURL(file);
            });

        const formData = new FormData();
        formData.append('base64_encoded_data', base64_encoded_data);
        formData.append('file_name', file.name);
        formData.append('file_type', file.type);
        console.log(Object.fromEntries(formData.entries()));
        auth.authenticatedFetch('/api/upload', {
            method: 'POST',
            body: formData
        }).then(res => res.json()).then((response) => {
            const file_id = response.file_id;
            if(file_id === undefined) {
                console.error('Upload failed', {response});
                return;
            }
            if(file_id.length !== crypto.randomUUID().length){
                console.error('Unexpected file_id format', {file_id});
            }
            console.log({file_id});
            window.open(`/api/upload/${file_id}`, '_blank');
        });
    }
    return <form>
        <input type="file" name="fileUpload" required onChange={handleFileChange}/>
    </form>
};
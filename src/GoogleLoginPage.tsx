import { GoogleLogin } from '@react-oauth/google';
import AuthContext from './AuthContext.tsx';
import { useNavigate } from 'react-router-dom';
import { User } from '../api/auth.mts';

export default () => {
    const auth = AuthContext.useAuth();
    const navigate = useNavigate();
    return <GoogleLogin
        useOneTap={true}
        onSuccess={async (credentialResponse) => {
            //https://developers.google.com/identity/gsi/web/guides/display-google-one-tap#credential_response
            const id_token = credentialResponse.credential!;
            const body = new FormData();
            body.append('id_token', id_token);
            const response = await fetch('/api/auth',{body, method: 'POST'}).then(res => res.json());
            if(response.error){
                console.error('Authentication failed', response.error);
                return;
            }
            const user: User = response;
            console.log({user});
            auth.login(id_token,user);
            navigate('/google-login-complete');
        }}
        onError={() => {
            alert('Login Failed');
        }}
    />
};
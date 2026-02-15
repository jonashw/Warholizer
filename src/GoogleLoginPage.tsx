import { GoogleLogin } from '@react-oauth/google';
export default () =>
    <GoogleLogin
        onSuccess={(credentialResponse) => {
            console.log(credentialResponse);
        }}
        onError={() => {
            console.log('Login Failed');
        }}
    />;
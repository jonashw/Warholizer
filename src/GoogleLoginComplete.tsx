import { useNavigate } from 'react-router-dom';
import AuthContext from './AuthContext.tsx';
export default () => {
    const navigate = useNavigate();
    const auth = AuthContext.useAuth();
    //const pictureRef = React.useRef<HTMLImageElement>(null);

    if(!auth.state){
        return <></>;
    }
    const logout = () => {
        auth.logout();
        navigate('/google-login');
    }
    const user = auth.state.user;
    return (<div className="bg-light p-4">
        <div>
            <h1>Welcome, {user.name}!</h1>
            {/*
                <p>Picture: {user.picture}</p>
                <a href={user.picture}>Picture</a>
                <img src={user.picture} alt="Profile" ref={pictureRef} onError={e => {
                    console.error(e);
                }}/>
            */}
            <p>Email: {user.email}</p>
            <button className="btn btn-outline-danger" onClick={logout}>Logout</button>
        </div>
    </div>);
};
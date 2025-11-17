import "./Home.css";
import Navbar from "../../Components/Navbar/Navbar.jsx";
import Body from "../../Components/Body/Body.jsx";
export default function Home(){
    return(
        <div className="home-container">
            <Navbar />
            <Body />
        </div>
    );
}
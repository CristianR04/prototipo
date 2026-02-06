import TablaHorariosSimplificada from "./components/HorariosMain";
import SimpleMusicPlayer from './components/MusicPlayer';

// Define las canciones aquí o en otro archivo
const myTracks = [
  {
    id: 1,
    title: "Canción 1",
    url: "/music/La ventana marroncita.mp3"
  },
  {
    id: 2,
    title: "Canción 2",
    url: "/music/La Suerte Está Echada.mp3"
  },
  {
    id: 3,
    title: "Canción 3",
    url: "/music/El Cóndor Herido.mp3"
  }
];

export default function HorariosPage() {
    return (
        <>
        {/* Pasa las tracks como prop */}
            <SimpleMusicPlayer tracks={myTracks} />

            <TablaHorariosSimplificada />
            
            
        </>
    )
}
// src/app/company/LocationMap.tsx

"use client";
import React, { FC, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L, { LatLngTuple } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet marker icons in React environments
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Map component containing the Leaflet logic
interface LocationMapProps {
    initialPosition: LatLngTuple; 
    onLocationChange: (lat: number, lng: number) => void;
}

// Component to handle map events and updates
const MapEvents: FC<{
    onLocationChange: (lat: number, lng: number) => void;
    initialPosition: LatLngTuple;
}> = ({ onLocationChange, initialPosition }) => {
    const [position, setPosition] = useState<LatLngTuple>(initialPosition);
    const map = useMap();

    useMapEvents({
        click: (e) => {
            const { lat, lng } = e.latlng;
            const newPos: LatLngTuple = [lat, lng];
            setPosition(newPos);
            onLocationChange(lat, lng);
        },
    });
    
    // Effect to update map view when initialPosition changes
    useEffect(() => {
        map.setView(initialPosition, map.getZoom());
        setPosition(initialPosition);
    }, [initialPosition, map]);

    return (
        <Marker 
            position={position} 
            draggable={true} 
            eventHandlers={{
                dragend: (e: any) => {
                    const { lat, lng } = e.target.getLatLng();
                    const newPos: LatLngTuple = [lat, lng];
                    setPosition(newPos);
                    onLocationChange(lat, lng);
                },
            }}
        />
    );
};

const LocationMap: FC<LocationMapProps> = ({ initialPosition, onLocationChange }) => {
    const [isClient, setIsClient] = useState(false);

    // Ensure this only runs on client side to avoid SSR issues
    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) {
        return (
            <div 
                className="d-flex align-items-center justify-content-center bg-light rounded shadow-sm"
                style={{ height: '100%', minHeight: '300px', width: '100%' }}
            >
                <div className="text-center text-muted">
                    <div className="spinner-border mb-2" role="status">
                        <span className="visually-hidden">Loading map...</span>
                    </div>
                    <p>Loading map...</p>
                </div>
            </div>
        );
    }

    return (
        <MapContainer 
            center={initialPosition} 
            zoom={5} 
            scrollWheelZoom={true}
            style={{ height: '100%', minHeight: '300px', width: '100%' }}
            className="rounded shadow-sm"
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapEvents 
                onLocationChange={onLocationChange} 
                initialPosition={initialPosition} 
            />
        </MapContainer>
    );
};

export default LocationMap;
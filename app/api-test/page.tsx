'use client';

export default function ApiTestPage() {
  async function sendTest() {
    const res = await fetch('/api/dzialki', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tytul: "Test działka",
        powierzchniaM2: 1000,
        cenaPln: 150000,
        opis: "Test ogłoszenie",
        przeznaczenia: ["BUDOWLANA"],
        telefon: "600600600",
        email: "test@test.pl",
        lat: 51.368,
        lng: 19.356,
        locationLabel: "Bełchatów",
        locationFull: "Bełchatów, Polska",
        placeId: "test",
        mapsUrl: "https://maps.google.com",
        locationMode: "EXACT",
        parcelText: "obręb 0010, działka 123/4",
        zdjecia: [
          {
            url: "https://picsum.photos/800/600",
            publicId: "demo/test",
            kolejnosc: 0
          }
        ]
      }),
    });

    const data = await res.json();
    console.log(data);
    alert(JSON.stringify(data, null, 2));
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>API TEST</h1>
      <button
        onClick={sendTest}
        style={{
          padding: 12,
          background: "black",
          color: "white",
          borderRadius: 8,
        }}
      >
        Wyślij test POST
      </button>
    </div>
  );
}

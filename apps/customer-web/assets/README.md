# LOADIN customer brand assets

The customer UI is wired to the locked LOADIN brand asset names below:

- `loadin-logo.png` — final LOADIN logo/wordmark
- `parcel.png` — glossy 3D 2-Wheeler Parcel visual
- `loading.png` — glossy 3D Loading Vehicle visual
- `helper.png` — glossy 3D Helper visual
- `shifting.png` — glossy 3D Full Shifting visual

These paths are intentionally stable so the same approved brand files can be reused across Customer, Partner/Fleet and Admin surfaces without changing UI code.

The UI includes graceful visual fallbacks when binary assets are not present in a development checkout. Production/release builds should include the approved PNG files at these exact paths.

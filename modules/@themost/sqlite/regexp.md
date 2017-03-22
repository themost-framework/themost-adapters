* Compile Regular Expression Extension for SQLite

** Using GCC/MinGW on Windows and Linux
gcc -shared -fPIC -Isqlite3 -o regexp.0.dylib regexp.c

** Using GCC on Mac OSX
gcc -dynamiclib -fPIC -Isqlite3 -o regexp.0.dylib regexp.c

** Microsoft Tools on Windows
cl /Gd regexp.c /I sqlite3 /DDLL /LD /link /export:sqlite3_extension_init /out:regexp.0.dylib
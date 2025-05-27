// Backend/gps_tokenizer.c
#include <stdio.h>
#include <string.h> // Para strlen
#include <stdint.h> // Para uintptr_t

// Declaración para exportación en Windows
#if defined(_WIN32) || defined(_WIN64)
    #define DLL_EXPORT __declspec(dllexport)
#else
    #define DLL_EXPORT
#endif

#define MAX_GPS_FIELDS 4
#define MAX_TOKEN_LEN 32 

static int copy_token_asm(const char *src, char delim, char *dest, int max_dest_len) {
    int copied_len = 0;
    if (!src || !dest || max_dest_len <= 0) {
        return 0;
    }

    
    asm volatile (
        "xorl %%eax, %%eax;"         // eax = 0 (será nuestra longitud copiada, copied_len)
        "movb %2, %%bl;"             // Carga delim en bl
        // rsi (src) y rdi (dest) ya están implícitos por los operandos de entrada
        // rcx (max_dest_len) también

    "1:" // Etiqueta de inicio de bucle
        "cmpl %%eax, %4;"            // Compara copied_len con max_dest_len - 1 (para dejar espacio para '\0')
        "jge 2f;"                    // Si copied_len >= max_dest_len -1, ir a fin_copia

        "movb (%1), %%dl;"           // Carga byte de src -> dl
        "testb %%dl, %%dl;"          // Comprueba si es fin de cadena (carácter nulo)
        "jz 2f;"                     // Si es nulo, ir a fin_copia

        "cmpb %%bl, %%dl;"           // Compara el byte actual (dl) con delim (bl)
        "je 2f;"                     // Si es igual al delimitador, ir a fin_copia

        "movb %%dl, (%3);"           // Copia el byte de src a dest
        "incq %1;"                   // src++
        "incq %3;"                   // dest++
        "incl %%eax;"                // copied_len++
        "jmp 1b;"                    // Repetir bucle

    "2:" // Etiqueta de fin_copia
        "movb $0, (%3);"             // Añade terminador nulo a dest
        "movl %%eax, %0;"            // Mueve el resultado de eax a copied_len
        : "=r" (copied_len)          // %0: Salida (copied_len)
        : "r" (src),                 // %1: Entrada (src)
          "r" ((unsigned char)delim),// %2: Entrada (delim)
          "r" (dest),                // %3: Entrada (dest)
          "r" (max_dest_len -1)      // %4: Entrada (max_dest_len - 1 para espacio de '\0')
        : "rax", "rbx", "rcx", "rdx", "rsi", "rdi", "memory", "cc" // Registros modificados
    );
    
    return copied_len;
}


/*
 * Función principal exportada.
 * Parsea 'input_str' buscando tokens delimitados por 'delim'.
 * Almacena los tokens en los buffers de salida proporcionados.
 * * Entradas:
 * input_str: La cadena a tokenizar (ej: "19.043,-98.194,60.5,25.1").
 * delim: El carácter delimitador (ej: ',').
 * out_lat, out_lon, out_hum, out_temp: Buffers para almacenar los tokens.
 * max_len: La longitud máxima de cada buffer de salida (debe ser MAX_TOKEN_LEN).
 *
 * Retorno:
 * El número de campos exitosamente extraídos y copiados.
 * Devuelve -1 si hay un error de puntero nulo.
 */
DLL_EXPORT int tokenize_and_extract_gps_fields_asm(
    const char *input_str,
    char delim,
    char *out_lat, char *out_lon, char *out_hum, char *out_temp,
    int max_len // Usamos una sola max_len asumiendo que todos los buffers son iguales
) {
    if (!input_str || !out_lat || !out_lon || !out_hum || !out_temp) {
        return -1; // Error de puntero nulo
    }

    // Limpiar buffers de salida (opcional pero buena práctica)
    out_lat[0] = '\0';
    out_lon[0] = '\0';
    out_hum[0] = '\0';
    out_temp[0] = '\0';

    char* buffers[MAX_GPS_FIELDS] = {out_lat, out_lon, out_hum, out_temp};
    const char *current_pos = input_str;
    int fields_found = 0;

    for (int i = 0; i < MAX_GPS_FIELDS; ++i) {
        if (*current_pos == '\0') { // Fin de la cadena de entrada
            break;
        }

        int copied_count = copy_token_asm(current_pos, delim, buffers[i], max_len);
        
        fields_found++;
        current_pos += copied_count; // Avanzar puntero de entrada

        if (*current_pos == delim) {
            current_pos++; // Saltar el delimitador para el siguiente token
        } else if (*current_pos == '\0') {
            break; // Fin de la cadena de entrada después de un token
        } else {
            // Situación inesperada, podría ser un token más largo que max_len
            // o formato incorrecto. Por ahora, simplemente paramos.
            break; 
        }
    }
    return fields_found;
}


#include <sqlite3ext.h>
#include <stddef.h>
#include <regex.h>
SQLITE_EXTENSION_INIT1
#ifdef _WIN32
__declspec(dllexport)
#endif
static void sqlite_regexp(sqlite3_context* context, int argc, sqlite3_value** values) {
           int ret;
           regex_t regex;
           char* reg = (char*)sqlite3_value_text(values[0]);
           char* text = (char*)sqlite3_value_text(values[1]);

           if (argc != 2) {
               sqlite3_result_error(context, "sql function regexp() called with invalid arguments.\n", -1);
               return;
           }

           if (reg == 0 || text == 0) {
                sqlite3_result_int(context,0);
                return;
           }

           ret = regcomp(&regex, reg, REG_EXTENDED | REG_NOSUB);
           if ( ret != 0 ) {
               sqlite3_result_error(context, "error compiling regular expression", -1);
               return;
           }

           ret = regexec(&regex, text , 0, NULL, 0);
           regfree(&regex);

           sqlite3_result_int(context, (ret != REG_NOMATCH));
       }

int sqlite3_extension_init(
  sqlite3 *db,
  char **pzErrMsg,
  const sqlite3_api_routines *pApi
){
  SQLITE_EXTENSION_INIT2(pApi)
  //sqlite3_create_function(db, "half", 1, SQLITE_ANY, 0, halfFunc, 0, 0);
  sqlite3_create_function(db, "regexp", 2, SQLITE_ANY,0, &sqlite_regexp,0,0);
  return 0;
}

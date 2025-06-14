import java.io.File
import java.io.FileWriter
import java.sql.DriverManager
import java.sql.SQLException

fun checkSqliteFiles(directory: String) {
    // Create or open title.txt in append mode
    File("title.txt").bufferedWriter(FileWriter(File("title.txt"), true)).use { writer ->
        // Walk through directory
        File(directory).walk()
            .filter { it.isFile && (it.extension == "db" || it.extension == "sqlite") }
            .forEach { dbFile ->
                try {
                    // Write database file name as header
                    writer.write("\n\nDatabase File: ${dbFile.absolutePath}\n")
                    writer.write("Size: ${String.format("%.2f", dbFile.length() / 1024.0)} KB\n")

                    // Connect to database
                    val connection = DriverManager.getConnection("jdbc:sqlite:${dbFile.absolutePath}")
                    connection.use { conn ->
                        val metadata = conn.metaData
                        
                        // Get list of tables
                        val tables = mutableListOf<String>()
                        val rs = metadata.getTables(null, null, null, arrayOf("TABLE"))
                        while (rs.next()) {
                            tables.add(rs.getString("TABLE_NAME"))
                        }

                        // Write table and column information
                        tables.forEach { tableName ->
                            writer.write("\nTable: $tableName\n")
                            writer.write("Columns:\n")

                            // Get column information
                            val stmt = conn.createStatement()
                            val tableInfo = stmt.executeQuery("PRAGMA table_info('$tableName')")
                            
                            while (tableInfo.next()) {
                                val columnName = tableInfo.getString("name")
                                val columnType = tableInfo.getString("type")
                                writer.write("  - $columnName ($columnType)\n")
                            }
                        }
                    }
                } catch (e: SQLException) {
                    writer.write("Error reading database ${dbFile.absolutePath}: ${e.message}\n")
                } catch (e: Exception) {
                    writer.write("Unexpected error with ${dbFile.absolutePath}: ${e.message}\n")
                }
            }
    }
}

// Execute the function with current directory
checkSqliteFiles(System.getProperty("user.dir"))

// To run this script:
// 1. Save this file as checkSqliteDbs.kts
// 2. Make sure you have Kotlin installed
// 3. Run: kotlinc -script checkSqliteDbs.kts
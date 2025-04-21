# GeepNotes API

A simple API for managing notes stored as JSON files.

## Endpoints

### Get All Notes

Retrieves all notes, optionally filtering them based on criteria provided in the request body.

*   **URL:** `/notes`
*   **Method:** `GET`
*   **Request Body (Optional):** JSON object containing filter criteria.
    *   `title` (string): Filter notes by title (case-insensitive partial match).
    *   `content` (string): Filter notes by content (case-insensitive partial match).
    *   `createdBefore` (string): Filter notes created before this date (ISO 8601 or YYYY-MM-DD).
    *   `createdAfter` (string): Filter notes created after this date (ISO 8601 or YYYY-MM-DD).
    *   `modifiedBefore` (string): Filter notes modified before this date (ISO 8601 or YYYY-MM-DD).
    *   `modifiedAfter` (string): Filter notes modified after this date (ISO 8601 or YYYY-MM-DD).
*   **Success Response:**
    *   **Code:** `200 OK`
    *   **Content:** `[ { "title": "Note Title", "content": "Note content...", "createdAt": "...", "modifiedAt": "..." }, ... ]`
*   **Error Responses:**
    *   **Code:** `400 Bad Request` <br> **Content:** `{ "message": "Invalid date format provided in filters. Use ISO 8601 or YYYY-MM-DD." }`
    *   **Code:** `404 Not Found` <br> **Content:** `{ "message": "Notes directory not found." }`
    *   **Code:** `500 Internal Server Error` <br> **Content:** `{ "message": "Error retrieving notes" }`

**Example Request Body (Filtering):**

```json
{
  "title": "meeting",
  "createdAfter": "2023-10-26"
}
```

### Create Notes

Creates one or more new notes.

*   **URL:** `/notes`
*   **Method:** `POST`
*   **Request Body:** JSON array of note objects. Each object must have a `title` property. The `content` property is optional.
*   **Success Response:**
    *   **Code:** `201 Created`
    *   **Content:** `{ "message": "X note(s) created successfully." }`
*   **Error Responses:**
    *   **Code:** `400 Bad Request` <br> **Content:** `{ "message": "Invalid input: Expected an array of notes, each with a non-empty title." }`
    *   **Code:** `500 Internal Server Error` <br> **Content:** `{ "message": "Error creating notes" }`

**Example Request Body:**

```json
[
  {
    "title": "Shopping List",
    "content": "Milk, Bread, Eggs"
  },
  {
    "title": "Meeting Notes"
  }
]
```

## Running the Server

1.  Make sure you have Node.js installed.
2.  Install dependencies: `npm install`
3.  Create a `.env` file with a `PORT` variable (optional, defaults to 3000).
4.  Ensure a `notes` directory exists in the project root.
5.  Start the server: `node server.js`

The server will run on `http://localhost:<PORT>`.

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

## Ensure that the stored procedure `PurgeAppointments` is correctly created in the database. You can verify this by running the following SQL command to check if the procedure exists:

`````markdown
SHOW PROCEDURE STATUS WHERE Name = 'PurgeAppointments';
`````

If the procedure does not exist, you can create it using the provided SQL script:

<file>
````sql
-- filepath: /x:/vac-suite/admin-dashboard/README.md
DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `PurgeAppointments`()
BEGIN
    -- Temporarily disable foreign key checks
    SET FOREIGN_KEY_CHECKS = 0;

    -- Reset the is_booked status for slots that were associated with bookings
    UPDATE slot 
    SET is_booked = 0
    WHERE id IN (SELECT slot_id FROM booking);

    -- Delete dependent records first
    DELETE FROM queue;
    DELETE FROM booking;

    -- Delete main records
    DELETE FROM appointment;
    DELETE FROM ticket_counter;

    -- Reset auto-increments
    ALTER TABLE queue AUTO_INCREMENT = 1;
    ALTER TABLE booking AUTO_INCREMENT = 1;
    ALTER TABLE appointment AUTO_INCREMENT = 1;
    ALTER TABLE ticket_counter AUTO_INCREMENT = 1;

    -- Re-enable foreign key checks
    SET FOREIGN_KEY_CHECKS = 1;
END$$
DELIMITER ;
`````

Ensure that the stored procedure `PurgeSlots` is correctly created in the database. You can verify this by running the following SQL command to check if the procedure exists:

`````markdown
SHOW PROCEDURE STATUS WHERE Name = 'PurgeSlots';
`````

If the procedure does not exist, you can create it using the provided SQL script:

<file>
````sql
-- filepath: /x:/vac-suite/admin-dashboard/README.md
DELIMITER $$
CREATE DEFINER=`root`@`localhost` PROCEDURE `PurgeSlots`()
BEGIN
    -- Temporarily disable foreign key checks
    SET FOREIGN_KEY_CHECKS = 0;

    -- Create a temporary table to store the count of deleted rows
    CREATE TEMPORARY TABLE temp_deleted_count (count INT);

    -- Delete dependent records first
    DELETE FROM queue WHERE slot_id IN (SELECT id FROM slot);
    DELETE FROM booking WHERE slot_id IN (SELECT id FROM slot);

    -- Delete main records and store the count of deleted rows
    DELETE FROM slot;
    INSERT INTO temp_deleted_count (count) VALUES (ROW_COUNT());

    -- Reset auto-increment
    ALTER TABLE slot AUTO_INCREMENT = 1;

    -- Re-enable foreign key checks
    SET FOREIGN_KEY_CHECKS = 1;

    -- Select the count of deleted rows
    SELECT count FROM temp_deleted_count;

    -- Drop the temporary table
    DROP TEMPORARY TABLE temp_deleted_count;
END$$
DELIMITER ;
`````

// server/src/controllers/user.controller.js

/**
 * Stub / placeholder controller for Users.
 * Replace the bodies below with real logic (DB calls, etc).
 */

exports.createUser = async (req, res, next) => {
    try {
      // TODO: insert into your database
      const newUser = {
        id: 'sample-id',
        email: req.body.email,
        createdAt: new Date(),
      };
      return res.status(201).json({
        status: 'success',
        data: newUser,
      });
    } catch (err) {
      next(err);
    }
  };
  
  exports.updateUser = async (req, res, next) => {
    try {
      // TODO: update your database record
      const updated = {
        id: req.params.id,
        ...req.body,
        updatedAt: new Date(),
      };
      return res.status(200).json({
        status: 'success',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  };
  